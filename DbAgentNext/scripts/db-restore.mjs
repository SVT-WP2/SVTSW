import { spawnSync } from 'node:child_process'
import { existsSync, openSync } from 'node:fs'
import { resolve } from 'node:path'

import { config as loadEnv } from 'dotenv'


/**
 * `npm run db:restore`: replaces the database of `.env.development` with the `pg_dump -Fc` file that the
 * `db:restore` script of `package.json` names.
 *
 * The Postgres tools run in the container of `../Dev/docker-compose.postgres.yml`, so the host needs Docker only.
 * Variables set in the shell win over the file.
 */
const CONTAINER = 'postgres-db--local'

loadEnv({ path: resolve(import.meta.dirname, '../.env.development') })

const dump = process.argv[2]
if (!dump || !existsSync(dump)) {
    console.error(`Dump file not found: ${dump ?? '(none)'}. Set its path in the "db:restore" script of package.json.`)
    process.exit(1)
}

const user = process.env.SVT_DB_AGENT_DB_USER
const dbName = process.env.SVT_DB_AGENT_DB_NAME
// `docker exec -e PGPASSWORD` copies the value from this environment, so it is not on the command line.
const env = { ...process.env, PGPASSWORD: process.env.SVT_DB_AGENT_DB_PASS }

function run(args, stdin = 'inherit') {
    const result = spawnSync('docker', ['exec', '-i', '-e', 'PGPASSWORD', CONTAINER, ...args], {
        env,
        stdio: [stdin, 'inherit', 'inherit'],
    })
    if (result.status !== 0) {
        console.error(`${args[0]} failed: ${result.error?.message ?? `exit code ${result.status}`}`)
        process.exit(1)
    }
}

console.log(`Restoring ${dump} into database ${dbName} (container ${CONTAINER})`)
run(['dropdb', '-U', user, '--if-exists', '--force', dbName])
run(['createdb', '-U', user, dbName])
run(['pg_restore', '-U', user, '-d', dbName, '--no-owner', '--no-privileges', '--single-transaction'], openSync(dump, 'r'))
console.log(`Done. Run "npm run db:migration:up" to bring ${dbName} to the schema of this agent.`)
