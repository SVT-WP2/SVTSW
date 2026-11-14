import { ReflectMetadataProvider } from '@mikro-orm/decorators/legacy'
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
 * - Entities are listed, not discovered from files, because the app ships as one bundle. They use the
 *   legacy (`experimentalDecorators`) decorators, hence the explicit `ReflectMetadataProvider`
 *   (MikroORM 7 no longer defaults to it); every scalar property also declares its `type`.
 * - Connections are lazy (MikroORM 7 always), so the application boots and `/health` reports `down`
 *   while the database is unreachable instead of crashing at start; `ensureDatabase: false` so it never
 *   creates a database either.
 * - `forceUtcTimezone`: `timestamp without time zone` values are never shifted by the host zone.
 */
export function buildSvtDbOrmOptions(config: SvtDbOrmConfig, entities: SvtDbOrmEntities): Options {
    return {
        driver: PostgreSqlDriver,
        metadataProvider: ReflectMetadataProvider,
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        dbName: config.dbName,
        schema: config.schema,
        namingStrategy: SvtDbNamingStrategy,
        entities,
        discovery: {
            warnWhenNoEntities: false,
        },
        forceUtcTimezone: true,
        allowGlobalContext: false,
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
