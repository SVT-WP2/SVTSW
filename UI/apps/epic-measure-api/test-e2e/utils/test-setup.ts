import { AddressInfo } from 'node:net'

import { DiscoveryModule, DiscoveryService } from '@nestjs/core'
import { ClientKafka } from '@nestjs/microservices'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { Pool, QueryResultRow } from 'pg'
import { SvtDbAgentKafka } from 'svt-ts-types/kafka'

import { AppModule, configureEpicMeasureApiApp } from '../../src/app'

import { loadEpicApiE2eConfig } from './e2e-config'
import { toPgConfig, truncateE2eDatabase } from './e2e-database'


/** An HTTP response as the browser sees it: the status and the parsed JSON body (`undefined` when empty). */
export type E2eResponse<T = any> = {
    status: number
    body: T
}

/** How long a BFF Kafka client may take to get its reply partition after `connect()`. */
const REPLY_ASSIGNMENT_TIMEOUT_MS = 30_000

const REPLY_TOPIC = SvtDbAgentKafka.TopicName.RequestReply

/**
 * Lifecycle, HTTP and database helpers for the e2e specs of epic-measure-api, after DbAgentNext's `TestSetup`:
 *
 * ```ts
 * const setup = new TestSetup()
 * beforeAll(() => setup.init())
 * afterAll(() => setup.close())
 * beforeEach(() => setup.clearDatabase())
 *
 * const response = await setup.get<EpicWafer[]>('/api/wafers')
 * ```
 *
 * `init` boots the real `AppModule` in-process with the bootstrap of `main.ts` (`configureEpicMeasureApiApp`) and
 * listens on a free port; its Kafka clients talk to the DbAgentNext child process the global setup started, over
 * the e2e broker. Every request therefore crosses the whole path: HTTP → BFF → Kafka → agent → PostgreSQL → back.
 * Not booted: the `epic-ui` Kafka microservice of `main.ts` (it only logs the topics) and Swagger.
 */
export class TestSetup {

    private app!: NestExpressApplication
    private pool!: Pool
    private baseUrl!: string
    private kafkaClients: ClientKafka[] = []

    // ── Lifecycle ───────────────────────────────────────────────

    async init(): Promise<void> {
        const config = loadEpicApiE2eConfig()

        const moduleFixture = await Test.createTestingModule({ imports: [AppModule, DiscoveryModule] }).compile()
        this.app = moduleFixture.createNestApplication<NestExpressApplication>({ logger: ['error', 'warn'] })
        configureEpicMeasureApiApp(this.app)
        await this.app.init()
        await this.connectKafkaClients()

        await this.app.listen(0, '127.0.0.1')
        const { port } = this.app.getHttpServer().address() as AddressInfo
        this.baseUrl = `http://127.0.0.1:${port}`

        this.pool = new Pool(toPgConfig(config.database))
    }

    async close(): Promise<void> {
        // NestJS closes the clients one after another, and each consumer waits for its in-flight fetch (up to 5 s):
        // closed together first, the second close by app.close() is a no-op.
        await Promise.all(this.kafkaClients.map((client) => client.close()))
        await this.app?.close()
        await this.pool?.end()
    }

    // ── HTTP ────────────────────────────────────────────────────

    get<T = any>(path: string): Promise<E2eResponse<T>> {
        return this.request<T>('GET', path)
    }

    post<T = any>(path: string, body?: unknown): Promise<E2eResponse<T>> {
        return this.request<T>('POST', path, body)
    }

    patch<T = any>(path: string, body?: unknown): Promise<E2eResponse<T>> {
        return this.request<T>('PATCH', path, body)
    }

    /** One request against the BFF; `path` includes the `/api` prefix and the query string. */
    async request<T = any>(method: string, path: string, body?: unknown): Promise<E2eResponse<T>> {
        const response = await fetch(`${this.baseUrl}${path}`, {
            method,
            headers: body === undefined ? {} : { 'content-type': 'application/json' },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
        const text = await response.text()
        return { status: response.status, body: text ? JSON.parse(text) as T : undefined }
    }

    /** Every HTTP route the application serves, as `METHOD /path` (`GET /api/wafers/:waferId`), sorted. */
    routes(): string[] {
        type RouteLayer = { route?: { path: string; methods: Record<string, boolean> } }
        const express = this.app.getHttpAdapter().getInstance() as unknown as { router: { stack: RouteLayer[] } }
        return express.router.stack
            .flatMap(({ route }) => (route ? Object.keys(route.methods).map((method) => `${method.toUpperCase()} ${route.path}`) : []))
            .sort()
    }

    // ── Database ────────────────────────────────────────────────

    /** Empties every table of the agent's schema and restarts the identities (ids `1, 2, …` per test). */
    clearDatabase(): Promise<void> {
        return truncateE2eDatabase(this.pool)
    }

    /** Raw SQL (`$1` placeholders) for seeding rows no endpoint creates, and for asserting what landed. */
    async query<T extends QueryResultRow = Record<string, any>>(sql: string, params?: unknown[]): Promise<T[]> {
        const { rows } = await this.pool.query<T>(sql, params)
        return rows
    }

    /** `select count(*)` of one table of the agent's schema. */
    async count(table: string): Promise<number> {
        const [row] = await this.query<{ n: number }>(`select count(*)::int as n from main."${table}"`)
        return row.n
    }

    /** The database's `current_date` (`YYYY-MM-DD`): the date of the location rows the agent writes at creation. */
    async today(): Promise<string> {
        const [row] = await this.query<{ today: string }>('select current_date::text as today')
        return row.today
    }

    // ── Internal ────────────────────────────────────────────────

    /**
     * Connects every `ClientKafka` of the application (one per module) up front, so no test pays for a group join,
     * and checks that each consumer holds its reply partition: a request from a client without one fails with
     * `InvalidKafkaClientTopicException`, which would point at the broker or a leftover group member, not at the code.
     */
    private async connectKafkaClients(): Promise<void> {
        const clients = this.app.get(DiscoveryService).getProviders()
            .map((wrapper) => wrapper.instance as unknown)
            .filter((instance): instance is ClientKafka => instance instanceof ClientKafka)
        this.kafkaClients = clients
        await Promise.all(clients.map((client) => client.connect()))

        const deadline = Date.now() + REPLY_ASSIGNMENT_TIMEOUT_MS
        while (!clients.every((client) => client.getConsumerAssignments()[REPLY_TOPIC] !== undefined)) {
            if (Date.now() > deadline) {
                throw new Error(`The BFF's Kafka clients got no partition of ${REPLY_TOPIC} within ${REPLY_ASSIGNMENT_TIMEOUT_MS / 1000} s`)
            }
            await new Promise((resolve) => setTimeout(resolve, 50))
        }
    }

}
