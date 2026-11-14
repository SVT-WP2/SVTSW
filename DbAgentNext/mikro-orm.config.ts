import * as path from 'path'

import { defineConfig } from '@mikro-orm/postgresql'
import { TsMorphMetadataProvider } from '@mikro-orm/reflection'
import * as dotenv from 'dotenv'

import { createSvtDbAgentNextConfig } from './src/config'
import { SvtDbNamingStrategy } from './src/db/orm'


/**
 * MikroORM CLI configuration (migrations, schema diff): `npm run db:*`.
 *
 * The running application does not use this file; it builds its options in `src/db/orm` from the validated
 * environment. The CLI reuses the same validation (`createSvtDbAgentNextConfig`) after loading the app's
 * `.env.<NODE_ENV>`, so both always point at the same database. Entities are discovered from the TypeScript
 * sources with ts-morph here, while the bundle lists them explicitly.
 */
const envName = process.env.NODE_ENV ?? 'development'
dotenv.config({ path: path.resolve(__dirname, `.env.${envName}`) })

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
    entities: ['dist/db/data/**/*.entity.js'],
    entitiesTs: ['src/db/data/**/*.entity.ts'],
    migrations: {
        tableName: 'mikro_orm_migrations',
        path: 'dist/migrations',
        pathTs: 'src/migrations',
        snapshot: false,
    },
    baseDir: __dirname,
})
