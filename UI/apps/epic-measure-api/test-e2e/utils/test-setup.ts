import { randomBytes } from 'node:crypto'
import { AddressInfo } from 'node:net'

import { ClientKafka } from '@nestjs/microservices'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { hashEpicPassword } from 'epic/core'
import { Pool, QueryResultRow } from 'pg'
import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'

import { AppModule, configureEpicMeasureApiApp, connectEpicMeasureApiKafkaClients } from '../../src/app'
import { EpicAuthLoginThrottleService, EpicAuthSvc, EpicAuthUserCacheService } from '../../src/modules/auth'

import { loadEpicApiE2eConfig } from './e2e-config'
import { toPgConfig, truncateE2eDatabase } from './e2e-database'


/** An HTTP response as the browser sees it: the status and the parsed JSON body (`undefined` when empty). */
export type E2eResponse<T = any> = {
    status: number
    body: T
}

/** A logged-in user of the suite: the user and the `Cookie` header that its log-in set. */
export type E2eSession = {
    user: EpicAuthUser
    cookie: string
}

/** A user that a spec created in the database, with its plain test password (made for this run). */
export type E2eUser = EpicAuthUser & {
    password: string
    isActive: boolean
}

/** The requests of one session (`null`: no session at all). */
export type E2eHttp = {
    get<T = any>(path: string): Promise<E2eResponse<T>>
    post<T = any>(path: string, body?: unknown): Promise<E2eResponse<T>>
    patch<T = any>(path: string, body?: unknown): Promise<E2eResponse<T>>
    request<T = any>(method: string, path: string, body?: unknown): Promise<E2eResponse<T>>
}

/** The Admin that the suite runs as: always user 1, put back by every `clearDatabase()`. */
export const E2E_ADMIN = { id: 1, login: 'e2e-admin', name: 'E2E Admin', role: EpicUserRole.Admin } satisfies EpicAuthUser

/** A test password: random for each run, so no password is written in the suite. */
export function randomE2ePassword(): string {
    return `e2e-${randomBytes(12).toString('base64url')}`
}

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
 *
 * The suite runs as a logged-in Admin (`E2E_ADMIN`), through the real `EpicAuthGuard`: `init` empties the database,
 * enters that user and logs it in, and `get` / `post` / `patch` / `request` send its session cookie. `as(null)` sends
 * no cookie; `loginAs(role)` logs in as a new user with that role.
 */
export class TestSetup {

    private app!: NestExpressApplication
    private pool!: Pool
    private baseUrl!: string
    private kafkaClients: ClientKafka[] = []
    private readonly adminPassword = randomE2ePassword()
    private adminPasswordHash!: string
    private adminSession!: E2eSession

    // ── Lifecycle ───────────────────────────────────────────────

    async init(): Promise<void> {
        const config = loadEpicApiE2eConfig()

        const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile()
        this.app = moduleFixture.createNestApplication<NestExpressApplication>({ logger: ['error', 'warn'] })
        configureEpicMeasureApiApp(this.app)
        await this.app.init()
        await this.connectKafkaClients()

        await this.app.listen(0, '127.0.0.1')
        const { port } = this.app.getHttpServer().address() as AddressInfo
        this.baseUrl = `http://127.0.0.1:${port}`

        this.pool = new Pool(toPgConfig(config.database))

        this.adminPasswordHash = await hashEpicPassword(this.adminPassword)
        await this.clearDatabase()
        this.adminSession = await this.login(E2E_ADMIN.login, this.adminPassword)
    }

    async close(): Promise<void> {
        // NestJS closes the clients one after another, and each consumer waits for its in-flight fetch (up to 5 s):
        // closed together first, the second close by app.close() is a no-op.
        await Promise.all(this.kafkaClients.map((client) => client.close()))
        await this.app?.close()
        await this.pool?.end()
    }

    // ── HTTP ────────────────────────────────────────────────────

    /** The session of `E2E_ADMIN`, which `get` / `post` / `patch` / `request` send. */
    get admin(): E2eSession {
        return this.adminSession
    }

    get<T = any>(path: string): Promise<E2eResponse<T>> {
        return this.request<T>('GET', path)
    }

    post<T = any>(path: string, body?: unknown): Promise<E2eResponse<T>> {
        return this.request<T>('POST', path, body)
    }

    patch<T = any>(path: string, body?: unknown): Promise<E2eResponse<T>> {
        return this.request<T>('PATCH', path, body)
    }

    /** One request of `E2E_ADMIN` against the BFF; `path` includes the `/api` prefix and the query string. */
    request<T = any>(method: string, path: string, body?: unknown): Promise<E2eResponse<T>> {
        return this.as(this.adminSession).request<T>(method, path, body)
    }

    /** The requests of another session, or of none (`null`: no cookie). */
    as(session: E2eSession | null): E2eHttp {
        const request = async <T>(method: string, path: string, body?: unknown): Promise<E2eResponse<T>> => {
            const response = await this.fetch(method, path, { body, cookie: session?.cookie })
            const text = await response.text()
            return { status: response.status, body: text ? JSON.parse(text) as T : undefined }
        }
        return {
            get: (path) => request('GET', path),
            post: (path, body) => request('POST', path, body),
            patch: (path, body) => request('PATCH', path, body),
            request,
        }
    }

    /**
     * The raw response, headers included (the cookies of the log-in). No cookie unless `cookie` is given. A `body` is
     * sent as JSON; with `contentType`, a string `body` is sent as it is, with that type (a form a page could post).
     */
    fetch(method: string, path: string, options: { body?: unknown; cookie?: string; contentType?: string } = {}): Promise<Response> {
        const headers: Record<string, string> = {}
        if (options.contentType !== undefined) {
            headers['content-type'] = options.contentType
        }
        else if (options.body !== undefined) {
            headers['content-type'] = 'application/json'
        }
        if (options.cookie !== undefined) {
            headers['cookie'] = options.cookie
        }
        let body: string | undefined
        if (options.body !== undefined) {
            body = options.contentType !== undefined ? String(options.body) : JSON.stringify(options.body)
        }
        return fetch(`${this.baseUrl}${path}`, { method, headers, body })
    }

    /** Logs in with `POST /api/auth/login`; fails the test unless the BFF answers `200` with a session cookie. */
    async login(login: string, password: string): Promise<E2eSession> {
        const response = await this.fetch('POST', '/api/auth/login', { body: { login, password } })
        const text = await response.text()
        const cookie = response.headers.getSetCookie()
            .map((header) => header.split(';')[0])
            .find((pair) => pair.startsWith(`${EpicAuthSvc.DEFAULT_SESSION_COOKIE_NAME}=`))
        if (response.status !== 200 || !cookie) {
            throw new Error(`The log-in of ${login} answered ${response.status} ${text}`)
        }
        return { user: JSON.parse(text) as EpicAuthUser, cookie }
    }

    /** A new user of that role (login `e2e-role-<role>`), logged in. Valid until the next `clearDatabase()`. */
    async loginAs(role: EpicUserRole): Promise<E2eSession> {
        const user = await this.createUser({ login: `e2e-role-${role.toLowerCase()}`, name: `E2E ${role}`, role })
        return this.login(user.login, user.password)
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

    /**
     * Empties every table of the agent's schema and restarts the identities (ids `1, 2, …` per test), then enters
     * `E2E_ADMIN` again as user 1, so its session stays valid. Also forgets what the BFF keeps in memory about users
     * (the guard's cache, the counter of wrong log-ins): a new test starts from nothing.
     */
    async clearDatabase(): Promise<void> {
        await truncateE2eDatabase(this.pool)
        const id = await this.insertUser({ ...E2E_ADMIN, isActive: true }, this.adminPasswordHash)
        if (id !== E2E_ADMIN.id) {
            throw new Error(`The e2e Admin got id ${id}, not ${E2E_ADMIN.id}: the identity of SvtUser did not restart`)
        }
        this.app.get(EpicAuthUserCacheService).clear()
        this.app.get(EpicAuthLoginThrottleService).clearAll()
    }

    /**
     * A user entered in the database, as the first Admin of an installation is. Quicker than `POST /api/users`, and
     * it can enter a user that is switched off; `test-e2e/users` tests that route itself.
     */
    async createUser(user: { login: string; name: string; role: EpicUserRole; isActive?: boolean; password?: string }): Promise<E2eUser> {
        const password = user.password ?? randomE2ePassword()
        const isActive = user.isActive ?? true
        const id = await this.insertUser({ ...user, isActive }, await hashEpicPassword(password))
        return { id, login: user.login, name: user.name, role: user.role, isActive, password }
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

    private async insertUser(
        user: { login: string; name: string; role: EpicUserRole; isActive: boolean },
        passwordHash: string,
    ): Promise<number> {
        const [row] = await this.query<{ id: number }>(
            'insert into main."SvtUser" (login, name, role, "passwordHash", "isActive") values ($1, $2, $3, $4, $5) returning id',
            [user.login, user.name, user.role, passwordHash, user.isActive],
        )
        return row.id
    }

    /**
     * Connects every `ClientKafka` of the application as `main.ts` does (`connectEpicMeasureApiKafkaClients`), so no
     * test pays for a group join, and fails unless each consumer holds its reply partition: a request from a client
     * without one fails with `InvalidKafkaClientTopicException`, which would point at the broker or a leftover group
     * member, not at the code.
     */
    private async connectKafkaClients(): Promise<void> {
        const { clients, unassigned } = await connectEpicMeasureApiKafkaClients(this.app)
        this.kafkaClients = clients
        if (unassigned > 0) {
            throw new Error(`${unassigned} of the BFF's Kafka clients got no partition of the reply topic within 30 s`)
        }
    }

}
