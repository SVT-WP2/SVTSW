import { Client, ClientConfig, Pool } from 'pg'

import { EpicApiE2eDatabaseConfig } from './e2e-config'


/** The agent's schema (`SVT_DB_AGENT_DB_SCHEMA`); MikroORM keeps its migrations table there too. */
export const SVT_DB_SCHEMA = 'main'

export function toPgConfig(config: EpicApiE2eDatabaseConfig, database = config.database): ClientConfig {
    return { host: config.host, port: config.port, user: config.user, password: config.password, database }
}

/** Creates the e2e database on first use; the agent's migrations then create its schema. */
export async function ensureE2eDatabase(config: EpicApiE2eDatabaseConfig): Promise<void> {
    const client = new Client(toPgConfig(config, 'postgres'))
    try {
        await client.connect()
    }
    catch (error) {
        throw new Error(
            `No PostgreSQL at ${config.host}:${config.port} (${error instanceof Error ? error.message : String(error)}). `
            + 'Start it from the repository root: docker compose -f Dev/docker-compose.postgres.yml up -d '
            + '(or set EPIC_API_E2E_DB_* in apps/epic-measure-api/.env.test.local).',
        )
    }
    try {
        const { rowCount } = await client.query('select 1 from pg_database where datname = $1', [config.database])
        if (!rowCount) {
            await client.query(`create database "${config.database}" owner "${config.user}"`)
        }
    }
    finally {
        await client.end()
    }
}

/** The migrations recorded in MikroORM's table (none when the schema does not exist yet). */
export async function appliedMigrationNames(config: EpicApiE2eDatabaseConfig): Promise<string[]> {
    const client = new Client(toPgConfig(config))
    await client.connect()
    try {
        const { rows } = await client.query<{ exists: boolean }>(
            'select to_regclass($1) is not null as exists',
            [`${SVT_DB_SCHEMA}.mikro_orm_migrations`],
        )
        if (!rows[0].exists) {
            return []
        }
        const applied = await client.query<{ name: string }>(`select name from ${SVT_DB_SCHEMA}.mikro_orm_migrations`)
        return applied.rows.map((row) => row.name.replace(/\.(ts|js)$/, ''))
    }
    finally {
        await client.end()
    }
}

/**
 * Empties every table of the agent's schema (not MikroORM's migrations table) and restarts the identities, so the
 * ids a test sees are `1, 2, …`. The same statement as the agent's own e2e harness.
 */
export async function truncateE2eDatabase(pool: Pool): Promise<void> {
    const { rows } = await pool.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = $1 and table_type = 'BASE TABLE' and table_name <> 'mikro_orm_migrations'`,
        [SVT_DB_SCHEMA],
    )
    if (rows.length > 0) {
        const list = rows.map((row) => `${SVT_DB_SCHEMA}."${row.table_name}"`).join(', ')
        await pool.query(`truncate table ${list} restart identity cascade`)
    }
}
