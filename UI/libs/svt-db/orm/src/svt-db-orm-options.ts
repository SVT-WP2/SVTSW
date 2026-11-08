import { Options, PostgreSqlDriver } from '@mikro-orm/postgresql'

import { SvtDbOrmConfig } from './models'
import { SvtDbNamingStrategy } from './svt-db-naming-strategy'


/** The explicit entity list the application passes in; no glob discovery, so the webpack bundle works. */
export type SvtDbOrmEntities = NonNullable<Options['entities']>

/**
 * Runtime MikroORM options shared by the application module and the integration tests.
 *
 * - `schema: main` and the {@link SvtDbNamingStrategy}: the database uses quoted camelCase identifiers
 *   (`"waferId"`, `main."WaferType"`) and PostgreSQL's default constraint names; every entity names its
 *   table explicitly.
 * - No dynamic file access: entities are listed, not discovered, because the app ships as one bundle.
 * - `connect: false`: the pool connects on first use, so the application boots and `/health` reports
 *   `down` while the database is unreachable instead of crashing at start.
 * - `forceUtcTimezone`: `timestamp without time zone` values are never shifted by the host zone.
 */
export function buildSvtDbOrmOptions(config: SvtDbOrmConfig, entities: SvtDbOrmEntities): Options {
    return {
        driver: PostgreSqlDriver,
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        dbName: config.dbName,
        schema: config.schema,
        namingStrategy: SvtDbNamingStrategy,
        entities,
        discovery: {
            disableDynamicFileAccess: true,
            warnWhenNoEntities: false,
        },
        forceUtcTimezone: true,
        allowGlobalContext: false,
        connect: false,
        ensureDatabase: false,
        debug: config.debug,
        migrations: {
            tableName: 'mikro_orm_migrations',
            path: 'migrations',
            pathTs: 'src/migrations',
            snapshot: false,
        },
    }
}
