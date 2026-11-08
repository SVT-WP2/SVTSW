import { readdirSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { Constructor, MikroORM } from '@mikro-orm/core'
import { Migration } from '@mikro-orm/migrations'
import { EntityManager, MikroORM as PostgreSqlMikroORM } from '@mikro-orm/postgresql'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { EpicKafkaMessage } from 'epic/entities'
import { buildSvtDbOrmOptions } from 'svt-db/orm'

import { AppModule } from '../../src/app/app.module'
import { SvtDbAgentNextConfig } from '../../src/config'
import { SvtDbAgentNextReply, SvtDbAgentNextRequestDispatcher } from '../../src/modules/dispatch'
import { buildSvtDbAgentNextKafkaOptions, SvtDbAgentNextHeartbeatService } from '../../src/modules/kafka'


/** A request envelope as a client would send it; the typed message classes of `epic/entities` fit too. */
export type E2eRequest = EpicKafkaMessage | { type: string; data?: unknown }

export type TestSetupOptions = {
    /**
     * Environment variables set before the application boots and restored by `close()`, e.g. a feature flag
     * (`SVT_DB_AGENT_FEATURE_CHIP_BLOCKS: 'true'`). The configuration is built from `process.env` per boot.
     */
    env?: Record<string, string>
    /**
     * Also connect the Kafka microservice and start the heartbeat, exactly as `main.ts` does, against the
     * broker of `.env.test`. Only the broker-backed smoke spec asks for it; every other spec talks to the
     * dispatcher directly.
     */
    kafka?: boolean
}

/**
 * Lifecycle, database and messaging helpers for the e2e specs, after rentaly's `TestSetup`:
 *
 * ```ts
 * const setup = new TestSetup()
 * beforeAll(() => setup.init())
 * afterAll(() => setup.close())
 * beforeEach(() => setup.clearDatabase())
 *
 * const reply = await setup.send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({ create }))
 * ```
 *
 * `init` boots the real `AppModule` against the database of `.env.test` and brings its schema to the latest
 * migration. `send` is the Kafka equivalent of supertest's `request()`: it hands the envelope to the same
 * dispatcher the Kafka controller delegates to, after a JSON round trip on both sides, so what the test sees
 * is what the wire carries. Only the transport itself (NestJS's Kafka server) is not under test.
 */
export class TestSetup {

    private app!: INestApplication
    private orm!: MikroORM
    private dispatcher!: SvtDbAgentNextRequestDispatcher
    private previousEnv: Record<string, string | undefined> = {}

    constructor(private readonly options: TestSetupOptions = {}) {
    }

    // ── Lifecycle ───────────────────────────────────────────────

    async init(): Promise<void> {
        for (const [key, value] of Object.entries(this.options.env ?? {})) {
            this.previousEnv[key] = process.env[key]
            process.env[key] = value
        }

        const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()
        this.app = moduleFixture.createNestApplication({ logger: ['error', 'warn'] })
        if (this.options.kafka) {
            const { brokers } = this.app.get(ConfigService<SvtDbAgentNextConfig, true>).get('kafka', { infer: true })
            this.app.connectMicroservice(buildSvtDbAgentNextKafkaOptions(brokers), { inheritAppConfig: true })
        }
        await this.app.init()
        if (this.options.kafka) {
            await this.app.startAllMicroservices()
            await this.app.get(SvtDbAgentNextHeartbeatService).start()
        }

        this.orm = this.app.get(MikroORM)
        this.dispatcher = this.app.get(SvtDbAgentNextRequestDispatcher)

        await this.migrate()
    }

    async close(): Promise<void> {
        await this.app?.close()
        for (const [key, value] of Object.entries(this.previousEnv)) {
            if (value === undefined) {
                delete process.env[key]
            }
            else {
                process.env[key] = value
            }
        }
        this.previousEnv = {}
    }

    // ── Database ────────────────────────────────────────────────

    /** Empties every table of schema `main` (not MikroORM's migrations table) and restarts the identities. */
    async clearDatabase(): Promise<void> {
        const connection = this.orm.em.getConnection()
        const tables = await connection.execute<{ table_name: string }[]>(
            `select table_name from information_schema.tables
             where table_schema = 'main' and table_type = 'BASE TABLE' and table_name <> 'mikro_orm_migrations'`,
        )
        if (tables.length > 0) {
            const list = tables.map((table) => `main."${table.table_name}"`).join(', ')
            await connection.execute(`truncate table ${list} restart identity cascade`)
        }
    }

    /** A fresh entity manager for seeding and assertions. */
    em(): EntityManager {
        return this.orm.em.fork() as EntityManager
    }

    /** Raw SQL for assertions on what really landed in the database. */
    query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
        return this.orm.em.getConnection().execute<T[]>(sql, params)
    }

    getOrm(): MikroORM {
        return this.orm
    }

    // ── Messaging ───────────────────────────────────────────────

    /** Sends one request envelope and returns the reply envelope, both as they would travel over Kafka. */
    async send<TData = Record<string, any>>(message: E2eRequest): Promise<SvtDbAgentNextReply<TData>> {
        const wireRequest: unknown = JSON.parse(JSON.stringify(message))
        const reply = await this.dispatcher.dispatch(wireRequest)
        return JSON.parse(JSON.stringify(reply)) as SvtDbAgentNextReply<TData>
    }

    /** The message types the application handles; new slices must appear here and in a spec. */
    registeredTypes(): string[] {
        return this.dispatcher.registeredTypes
    }

    // ── Internal ────────────────────────────────────────────────

    /**
     * Applies the application's migrations to the test database with a dedicated ORM instance. The
     * migration classes are imported from `src/migrations` (Vitest transforms the TypeScript), so no file
     * discovery and no compiled output is needed.
     */
    private async migrate(): Promise<void> {
        const config = this.app.get(ConfigService<SvtDbAgentNextConfig, true>).get('database', { infer: true })
        const migrationsDir = resolve(__dirname, '../../src/migrations')
        const migrationsList: { name: string; class: Constructor<Migration> }[] = []
        for (const file of readdirSync(migrationsDir).filter((name) => /^Migration\d+.*\.ts$/.test(name)).sort()) {
            const name = basename(file, '.ts')
            const module = await import(pathToFileURL(join(migrationsDir, file)).href) as Record<string, Constructor<Migration>>
            if (!module[name]) {
                throw new Error(`${file} must export a class named ${name}`)
            }
            migrationsList.push({ name, class: module[name] })
        }

        const orm = await PostgreSqlMikroORM.init({
            ...buildSvtDbOrmOptions(config, []),
            migrations: { tableName: 'mikro_orm_migrations', migrationsList, snapshot: false },
        })
        try {
            await orm.migrator.up()
        }
        finally {
            await orm.close(true)
        }
    }

}
