import { resolve } from 'node:path'

import { config as loadEnv } from 'dotenv'


/** `UI/apps/epic-measure-api`. */
export const EPIC_API_APP_ROOT = resolve(__dirname, '../..')

/** The standalone agent app (`../DbAgentNext` of the repository) the harness builds, migrates and runs. */
export const SVT_DB_AGENT_NEXT_ROOT = resolve(EPIC_API_APP_ROOT, '../../../DbAgentNext')

/** Where the agent child process writes its log (`UI/tmp` is git-ignored). */
export const EPIC_API_E2E_LOG_DIR = resolve(EPIC_API_APP_ROOT, '../../tmp/epic-measure-api-e2e')

export type EpicApiE2eDatabaseConfig = {
    host: string
    port: number
    user: string
    password: string
    database: string
}

export type EpicApiE2eConfig = {
    /** `host:port` of the dedicated e2e broker; the BFF reads it as `KAFKA_BROKER`, the agent as server + port. */
    kafkaBroker: string
    database: EpicApiE2eDatabaseConfig
    /** `GET /health` of the agent child process: the harness's readiness probe. */
    agentHttpPort: number
}

/**
 * Loads `apps/epic-measure-api/.env.test.local` (git-ignored, personal overrides) and `.env.test`, and returns the
 * e2e settings. dotenv never overrides a variable that is already set, so the precedence is:
 *   process environment (CI, a one-off override)  >  .env.test.local  >  .env.test
 * Called by the global setup (main process) and by `e2e-env.ts` (every spec file's worker).
 */
export function loadEpicApiE2eConfig(): EpicApiE2eConfig {
    process.env.NODE_ENV = 'test'
    loadEnv({ path: resolve(EPIC_API_APP_ROOT, '.env.test.local') })
    loadEnv({ path: resolve(EPIC_API_APP_ROOT, '.env.test') })

    const config: EpicApiE2eConfig = {
        kafkaBroker: required('KAFKA_BROKER'),
        database: {
            host: required('EPIC_API_E2E_DB_HOST'),
            port: Number(required('EPIC_API_E2E_DB_PORT')),
            user: required('EPIC_API_E2E_DB_USER'),
            password: required('EPIC_API_E2E_DB_PASS'),
            database: required('EPIC_API_E2E_DB_NAME'),
        },
        agentHttpPort: Number(required('EPIC_API_E2E_AGENT_HTTP_PORT')),
    }

    if (!config.database.database.endsWith('_e2e_test')) {
        throw new Error(
            `Refusing to run the e2e suite against database "${config.database.database}": the harness truncates every `
            + 'table, so EPIC_API_E2E_DB_NAME must end with _e2e_test.',
        )
    }

    return config
}

function required(name: string): string {
    const value = process.env[name]
    if (!value) {
        throw new Error(`${name} is not set: see apps/epic-measure-api/.env.test`)
    }
    return value
}
