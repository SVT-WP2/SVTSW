import { spawn, spawnSync } from 'node:child_process'
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'

import { EPIC_API_E2E_LOG_DIR, EpicApiE2eConfig, SVT_DB_AGENT_NEXT_ROOT } from './e2e-config'
import { appliedMigrationNames, SVT_DB_SCHEMA } from './e2e-database'


const AGENT_MAIN = join(SVT_DB_AGENT_NEXT_ROOT, 'dist/main.js')
const AGENT_RUNNER = resolve(__dirname, '../agent/run-agent.cjs')
const AGENT_LOG = join(EPIC_API_E2E_LOG_DIR, 'svt-db-agent-next.log')

/** Everything `npm run build` of the agent compiles; a newer file than `dist/main.js` means a rebuild. */
const AGENT_BUILD_INPUTS = [
    join(SVT_DB_AGENT_NEXT_ROOT, 'src'),
    resolve(SVT_DB_AGENT_NEXT_ROOT, '../Shared/svt-ts-types'),
    join(SVT_DB_AGENT_NEXT_ROOT, 'package-lock.json'),
    join(SVT_DB_AGENT_NEXT_ROOT, 'tsconfig.json'),
    join(SVT_DB_AGENT_NEXT_ROOT, 'tsconfig.app.json'),
    join(SVT_DB_AGENT_NEXT_ROOT, 'nest-cli.json'),
]

const AGENT_READY_TIMEOUT_MS = 90_000
const AGENT_STOP_TIMEOUT_MS = 15_000

export type E2eAgentProcess = {
    /** Stops the agent gracefully (it leaves its Kafka group), or kills it after 15 s. */
    stop(): Promise<void>
}

/** The agent's environment: its committed `.env.test` underneath, the e2e database and broker on top. */
function agentEnv(config: EpicApiE2eConfig): NodeJS.ProcessEnv {
    const [kafkaServer, kafkaPort] = config.kafkaBroker.split(':')
    return {
        ...process.env,
        NODE_ENV: 'test',
        SVT_DB_AGENT_DB_HOST: config.database.host,
        SVT_DB_AGENT_DB_PORT: String(config.database.port),
        SVT_DB_AGENT_DB_USER: config.database.user,
        SVT_DB_AGENT_DB_PASS: config.database.password,
        SVT_DB_AGENT_DB_NAME: config.database.database,
        SVT_DB_AGENT_DB_SCHEMA: SVT_DB_SCHEMA,
        SVT_DB_AGENT_KAFKA_SERVER: kafkaServer,
        SVT_DB_AGENT_KAFKA_PORT: kafkaPort,
        SVT_DB_AGENT_HTTP_PORT: String(config.agentHttpPort),
        SVT_DB_AGENT_LOGGER_TERM_VERBOSITY: 'STANDARD',
    }
}

/** Builds the agent (`npm run build` in DbAgentNext/) when `dist/main.js` is missing or older than its sources. */
export function buildAgentIfStale(): void {
    if (!existsSync(join(SVT_DB_AGENT_NEXT_ROOT, 'node_modules'))) {
        throw new Error(`${SVT_DB_AGENT_NEXT_ROOT} has no node_modules: run npm ci there first.`)
    }
    const builtAt = existsSync(AGENT_MAIN) ? statSync(AGENT_MAIN).mtimeMs : 0
    if (newestModification(AGENT_BUILD_INPUTS) <= builtAt) {
        return
    }
    console.info('[e2e] Building DbAgentNext: dist/main.js is missing or older than its sources (npm run build)')
    run('npm run build', 'npm run build')
}

/**
 * Applies the agent's migrations to the e2e database with its own CLI (`npm run db:migration:up`), unless every
 * migration of `DbAgentNext/src/migrations` is already recorded.
 */
export async function migrateAgentDatabase(config: EpicApiE2eConfig): Promise<void> {
    const migrations = readdirSync(join(SVT_DB_AGENT_NEXT_ROOT, 'src/migrations'))
        .filter((name) => /^Migration\d+.*\.ts$/.test(name))
        .map((name) => basename(name, '.ts'))
    const applied = new Set(await appliedMigrationNames(config.database))
    if (migrations.every((name) => applied.has(name))) {
        return
    }
    console.info(`[e2e] Migrating ${config.database.database} with the agent's migrations (npm run db:migration:up)`)
    run('npm run db:migration:up', 'npm run db:migration:up', agentEnv(config))
}

/**
 * Starts the built agent as a child process (through `agent/run-agent.cjs`, for a graceful stop) and resolves once
 * its `GET /health` answers: the agent listens on HTTP only after its Kafka consumer has started. Its output goes to
 * `UI/tmp/epic-measure-api-e2e/svt-db-agent-next.log`.
 */
export async function startAgent(config: EpicApiE2eConfig): Promise<E2eAgentProcess> {
    const healthUrl = `http://127.0.0.1:${config.agentHttpPort}/health`
    if (await isHealthy(healthUrl)) {
        throw new Error(
            `Something already answers ${healthUrl}: an agent left over from an earlier run? Stop it, or set `
            + 'EPIC_API_E2E_AGENT_HTTP_PORT in apps/epic-measure-api/.env.test.local.',
        )
    }

    mkdirSync(EPIC_API_E2E_LOG_DIR, { recursive: true })
    const log = openSync(AGENT_LOG, 'w')
    const child = spawn(process.execPath, [AGENT_RUNNER, AGENT_MAIN], {
        cwd: SVT_DB_AGENT_NEXT_ROOT,
        env: agentEnv(config),
        stdio: ['ignore', log, log, 'ipc'],
    })
    closeSync(log)

    let exitCode: number | null | undefined
    const exited = new Promise<void>((resolveExit) => {
        child.once('exit', (code) => {
            exitCode = code
            resolveExit()
        })
    })

    const deadline = Date.now() + AGENT_READY_TIMEOUT_MS
    while (!(await isHealthy(healthUrl))) {
        if (exitCode !== undefined || Date.now() > deadline) {
            child.kill()
            const reason = exitCode !== undefined ? `exited with code ${exitCode}` : `not healthy within ${AGENT_READY_TIMEOUT_MS / 1000} s`
            throw new Error(`DbAgentNext ${reason}. Last lines of ${AGENT_LOG}:\n${tail(AGENT_LOG, 40)}`)
        }
        await sleep(250)
    }

    return {
        async stop(): Promise<void> {
            if (exitCode !== undefined) {
                return
            }
            child.send('shutdown')
            const stopped = await Promise.race([exited.then(() => true), sleep(AGENT_STOP_TIMEOUT_MS).then(() => false)])
            if (!stopped) {
                child.kill()
            }
        },
    }
}

async function isHealthy(url: string): Promise<boolean> {
    try {
        const response = await fetch(url, { signal: AbortSignal.timeout(1000) })
        return response.ok
    }
    catch {
        return false
    }
}

function run(command: string, label: string, env: NodeJS.ProcessEnv = process.env): void {
    const result = spawnSync(command, { cwd: SVT_DB_AGENT_NEXT_ROOT, env, stdio: 'inherit', shell: true })
    if (result.status !== 0) {
        throw new Error(`${label} failed in ${SVT_DB_AGENT_NEXT_ROOT} (exit code ${result.status})`)
    }
}

function newestModification(paths: string[]): number {
    let newest = 0
    for (const path of paths.filter((candidate) => existsSync(candidate))) {
        const stats = statSync(path)
        if (!stats.isDirectory()) {
            newest = Math.max(newest, stats.mtimeMs)
            continue
        }
        for (const entry of readdirSync(path, { recursive: true, encoding: 'utf8' })) {
            if (entry.includes('node_modules') || entry.endsWith('.spec.ts')) {
                continue
            }
            newest = Math.max(newest, statSync(join(path, entry)).mtimeMs)
        }
    }
    return newest
}

function tail(path: string, lines: number): string {
    return existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/).slice(-lines).join('\n') : '(no log)'
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolveSleep) => setTimeout(resolveSleep, ms))
}
