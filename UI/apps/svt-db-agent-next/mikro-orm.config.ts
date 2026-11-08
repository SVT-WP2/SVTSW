import * as path from 'path'

import { defineConfig } from '@mikro-orm/postgresql'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'
import * as dotenv from 'dotenv'
import { SvtDbNamingStrategy } from 'svt-db/orm'

import { createSvtDbAgentNextConfig } from './src/config'


/**
 * MikroORM CLI configuration (migrations, schema diff): `npm run db-next:*` from `UI/`.
 *
 * The running application does not use this file; it builds its options in `svt-db/orm` from the validated
 * environment. The CLI reuses the same validation (`createSvtDbAgentNextConfig`) after loading the app's
 * `.env.<NODE_ENV>`, so both always point at the same database. Entities are discovered from the TypeScript
 * sources with ts-morph here, while the bundle lists them explicitly.
 */
const envName = process.env.NODE_ENV ?? 'development'
dotenv.config({ path: path.resolve(__dirname, `.env.${envName}`) })

const workspaceRoot = path.resolve(__dirname, '../..')
const { database } = createSvtDbAgentNextConfig(process.env)

export default defineConfig({
    host: database.host,
    port: database.port,
    user: database.user,
    password: database.password,
    dbName: database.dbName,
    schema: database.schema,
    namingStrategy: SvtDbNamingStrategy,
    forceUtcTimezone: true,
    ensureDatabase: false,
    debug: database.debug,
    metadataProvider: TsMorphMetadataProvider,
    metadataCache: { enabled: false },
    entities: ['dist/libs/svt-db/data/**/*.entity.js'],
    entitiesTs: ['libs/svt-db/data/src/**/*.entity.ts'],
    migrations: {
        tableName: 'mikro_orm_migrations',
        path: 'dist/apps/svt-db-agent-next/migrations',
        pathTs: 'apps/svt-db-agent-next/src/migrations',
        snapshot: false,
    },
    baseDir: workspaceRoot,
})
