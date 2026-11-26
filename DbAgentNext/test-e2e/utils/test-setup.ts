import { MikroORM } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { INestApplication } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Test } from '@nestjs/testing'
import { EpicKafkaMessage } from 'svt-ts-types/kafka'


import { AppModule } from '../../src/app/app.module'
import { SvtDbAgentNextConfig } from '../../src/config'
import { SvtDbOrmMigrationsService } from '../../src/db/orm'
import {
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextReply,
    SvtDbAgentNextRequestDispatcher,
    SvtDbAgentNextRequestHeaders,
} from '../../src/modules/dispatch'
import {
    buildSvtDbAgentNextKafkaOptions,
    SvtDbAgentNextHeartbeatService,
    SvtDbAgentNextKafkaBacklogService,
} from '../../src/modules/kafka'


/** A request envelope as a client would send it; the typed message classes of `epic/entities` fit too. */
export type E2eRequest = EpicKafkaMessage | { type: string; data?: unknown }

/** The headers of a request record that the agent reads, as raw strings (`SvtDbAgentNextRequestHeaders`). */
export type E2eRequestHeaders = SvtDbAgentNextRequestHeaders

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
 * migration, with the service that `main.ts` calls at start. `send` is the Kafka equivalent of supertest's
 * `request()`: it hands the envelope to the same dispatcher the Kafka controller delegates to, after a JSON round
 * trip on both sides, so what the test sees is what the wire carries. Only the transport itself (NestJS's Kafka
 * server) is not under test.
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
        await this.migrate()
        if (this.options.kafka) {
            await this.app.get(SvtDbAgentNextKafkaBacklogService).skip()
            await this.app.startAllMicroservices()
            await this.app.get(SvtDbAgentNextHeartbeatService).start()
        }

        this.orm = this.app.get(MikroORM)
        this.dispatcher = this.app.get(SvtDbAgentNextRequestDispatcher)
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

    /** Applies the pending migrations as the application does at start, and returns the names it applied. */
    migrate(): Promise<string[]> {
        return this.app.get(SvtDbOrmMigrationsService).up()
    }

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

    /**
     * Sends one request envelope and returns the reply envelope, both as they would travel over Kafka. `headers`
     * holds the raw values of the record's headers that the agent reads, for example `{ userId: '42' }` for
     * `svt_userId`; a spec can send a malformed value. Without it, the request has no such header.
     */
    async send<TData = Record<string, any>>(message: E2eRequest, headers?: E2eRequestHeaders): Promise<SvtDbAgentNextReply<TData>> {
        const wireRequest: unknown = JSON.parse(JSON.stringify(message))
        const reply = await this.dispatcher.dispatch(wireRequest, headers)
        return JSON.parse(JSON.stringify(reply)) as SvtDbAgentNextReply<TData>
    }

    /** The message types the application handles; new slices must appear here and in a spec. */
    registeredTypes(): string[] {
        return this.dispatcher.registeredTypes
    }

    /**
     * The definition that the dispatcher calls for a message type, so that a spec can spy on its `handle` and see the
     * context of a request (`vi.spyOn(definition, 'handle')`). The spy calls the real handler.
     */
    handlerDefinition(type: string): SvtDbAgentNextHandlerDefinition {
        const definitions = (this.dispatcher as unknown as { handlers: Map<string, SvtDbAgentNextHandlerDefinition> }).handlers
        const definition = definitions.get(type)
        if (!definition) {
            throw new Error(`No handler for ${type}`)
        }
        return definition
    }

}
