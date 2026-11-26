import { JwtService } from '@nestjs/jwt'
import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'
import { SvtDbAgentKafkaUsers, SvtDbAgentKafkaWaferTypes, SvtKafkaHeader } from 'svt-ts-types/kafka'

import {
    E2E_ADMIN,
    E2eRequestRecord,
    E2eRequestTopicReader,
    expectError,
    loadEpicApiE2eConfig,
    randomE2ePassword,
    TestSetup,
} from '../utils'


/** The one body of a failed log-in, whatever the cause. */
const LOGIN_FAILED = { statusCode: 401, message: 'Unknown combination login/password.', error: 'Unauthorized' }

/** The routes that answer without a session: the log-in, the log-out, the health routes (Docker's health check). */
const PUBLIC_ROUTES = ['POST /api/auth/login', 'POST /api/auth/logout', 'GET /api/health', 'GET /api/health/version']

/** A cookie attribute list, lower case: `['svt_session=…', 'max-age=43200', 'path=/', …]`. */
function cookieAttributes(header: string): string[] {
    return header.split(';').map((part) => part.trim().toLowerCase())
}

function sessionCookieOf(response: Response): string | undefined {
    return response.headers.getSetCookie().find((header) => header.startsWith('svt_session='))
}

describe('Auth (e2e)', () => {

    const setup = new TestSetup()
    const secret = process.env.SVT_UI_AUTH_SECRET

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    describe('POST /api/auth/login', () => {

        it('answers the user and sets the session cookie: HttpOnly, SameSite=Strict, Path=/, 12 hours, not Secure', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })

            const response = await setup.fetch('POST', '/api/auth/login', { body: { login: 'jane.doe', password: jane.password } })

            expect(response.status).toBe(200)
            const body = await response.json() as EpicAuthUser
            expect(body).toEqual({ id: jane.id, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })
            expect(Object.keys(body)).toEqual(['id', 'login', 'name', 'role'])
            const attributes = cookieAttributes(sessionCookieOf(response))
            expect(attributes[0]).toMatch(/^svt_session=[\w-]+\.[\w-]+\.[\w-]+$/)
            expect(attributes).toEqual(expect.arrayContaining(['httponly', 'samesite=strict', 'path=/', 'max-age=43200']))
            expect(attributes).not.toContain('secure')
        })

        it('answers 401 with one body and no cookie for an unknown login, a wrong password and a user switched off', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
            const off = await setup.createUser({ login: 'switched.off', name: 'Off', role: EpicUserRole.Admin, isActive: false })

            const attempts = [
                { login: 'nobody', password: jane.password },
                { login: 'jane.doe', password: `${jane.password}x` },
                { login: 'switched.off', password: off.password },
            ]
            for (const body of attempts) {
                const response = await setup.fetch('POST', '/api/auth/login', { body })

                expect(response.status, body.login).toBe(401)
                expect(await response.json()).toEqual(LOGIN_FAILED)
                expect(sessionCookieOf(response)).toBeUndefined()
            }
        })

        it('compares the login in lower case, after trimming', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })

            const session = await setup.login('  Jane.DOE ', jane.password)

            expect(session.user).toEqual({ id: jane.id, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
        })

        it('answers 429 to the sixth attempt after five wrong ones, with the right password too, and asks no DB agent', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
            for (let attempt = 1; attempt <= 5; attempt++) {
                const login = attempt % 2 ? 'jane.doe' : 'JANE.DOE'
                const response = await setup.as(null).post('/api/auth/login', { login, password: 'wrong' })
                expect(response, `attempt ${attempt}`).toEqual({ status: 401, body: LOGIN_FAILED })
            }
            const reader = new E2eRequestTopicReader(loadEpicApiE2eConfig().kafkaBroker)
            await reader.mark()

            const locked = await setup.fetch('POST', '/api/auth/login', { body: { login: 'jane.doe', password: jane.password } })
            // Another login is not locked; its request marks the end of what the reader waits for.
            const other = await setup.as(null).post('/api/auth/login', { login: 'somebody.else', password: 'wrong' })

            expect(locked.status).toBe(429)
            expect(await locked.json()).toEqual({
                statusCode: 429,
                message: 'Too many attempts. Try again in a minute.',
                error: 'Too Many Requests',
            })
            expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(55)
            expect(Number(locked.headers.get('retry-after'))).toBeLessThanOrEqual(60)
            expect(sessionCookieOf(locked)).toBeUndefined()
            expect(other).toEqual({ status: 401, body: LOGIN_FAILED })
            const records = await reader.read((all) => all.some((record) => record.value.data?.login === 'somebody.else'))
            expect(records.map((record) => record.value)).toEqual([
                { type: SvtDbAgentKafkaUsers.MessageType.GetUserCredentials, data: { login: 'somebody.else' } },
            ])
        })

        it('counts attempts sent at the same time one after another: five 401, then 429', async () => {
            await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })

            const responses = await Promise.all(Array.from({ length: 8 }, () => (
                setup.as(null).post('/api/auth/login', { login: 'jane.doe', password: 'wrong' }))))

            expect(responses.map((response) => response.status).sort()).toEqual([401, 401, 401, 401, 401, 429, 429, 429])
        })

        it('starts the count again after a successful log-in', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
            const wrongAttempts = async () => {
                for (let attempt = 1; attempt <= 4; attempt++) {
                    expect((await setup.as(null).post('/api/auth/login', { login: 'jane.doe', password: 'wrong' })).status).toBe(401)
                }
            }

            await wrongAttempts()
            await setup.login('jane.doe', jane.password)
            await wrongAttempts()

            expect((await setup.as(null).post('/api/auth/login', { login: 'jane.doe', password: jane.password })).status).toBe(200)
        })

        it('answers 400 for a body without a login or a password', async () => {
            expectError(await setup.as(null).post('/api/auth/login', { login: 'jane.doe' }), 400, 'password must be a string')
            expectError(await setup.as(null).post('/api/auth/login', { password: 'x' }), 400, 'login must be a string')
            expectError(await setup.as(null).post('/api/auth/login', { login: 'jane.doe', password: '' }), 400, 'password must be longer')
        })

    })

    describe('GET /api/auth/me', () => {

        it('answers the user of the session', async () => {
            expect(await setup.get('/api/auth/me')).toEqual({ status: 200, body: E2E_ADMIN })
        })

        it('answers each logged-in role with its user', async () => {
            for (const role of Object.values(EpicUserRole)) {
                const session = await setup.loginAs(role)

                expect(await setup.as(session).get('/api/auth/me')).toEqual({ status: 200, body: session.user })
                expect(session.user.role).toBe(role)
            }
        })

        it('answers 401 without a session', async () => {
            expectError(await setup.as(null).get('/api/auth/me'), 401, 'Unauthorized')
        })

        it('answers 401 for a token signed with another secret, an expired token, a token without a signature, and no token', async () => {
            const now = Math.floor(Date.now() / 1000)
            const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')
            const payload = Buffer.from(JSON.stringify({ sub: '1' })).toString('base64url')
            const tokens = {
                otherSecret: new JwtService({ secret: 'another-secret-that-is-long-enough-for-hs256' }).sign({ sub: '1' }),
                expired: new JwtService({ secret }).sign({ sub: '1', iat: now - 120, exp: now - 60 }),
                unsigned: `${header}.${payload}.`,
                numberSubject: new JwtService({ secret }).sign({ sub: 1 }),
                noToken: 'not-a-token',
            }
            for (const [name, token] of Object.entries(tokens)) {
                const response = await setup.as({ user: E2E_ADMIN, cookie: `svt_session=${token}` }).get('/api/auth/me')

                expect(response.status, name).toBe(401)
            }
        })

        it('answers 200 for a token signed with the secret: the check is the signature, not a list of sessions', async () => {
            const token = new JwtService({ secret }).sign({ sub: '1' }, { expiresIn: 60 })

            expect(await setup.as({ user: E2E_ADMIN, cookie: `svt_session=${token}` }).get('/api/auth/me'))
                .toEqual({ status: 200, body: E2E_ADMIN })
        })

        it('answers 401 for a valid token of a user that does not exist', async () => {
            const token = new JwtService({ secret }).sign({ sub: '99' }, { expiresIn: 60 })

            expect((await setup.as({ user: E2E_ADMIN, cookie: `svt_session=${token}` }).get('/api/auth/me')).status).toBe(401)
        })

    })

    describe('POST /api/auth/logout', () => {

        it('answers 204 and clears the cookie; the old token still verifies until it expires (known limit, #392)', async () => {
            const session = await setup.loginAs(EpicUserRole.User)

            const response = await setup.fetch('POST', '/api/auth/logout', { cookie: session.cookie })

            expect(response.status).toBe(204)
            const attributes = cookieAttributes(sessionCookieOf(response))
            expect(attributes[0]).toBe('svt_session=')
            expect(attributes).toEqual(expect.arrayContaining([
                'httponly', 'samesite=strict', 'path=/', 'expires=thu, 01 jan 1970 00:00:00 gmt',
            ]))
            expect((await setup.as(session).get('/api/auth/me')).status).toBe(200)
        })

        it('answers 204 without a session', async () => {
            expect(await setup.as(null).post('/api/auth/logout')).toEqual({ status: 204, body: undefined })
        })

    })

    describe('EpicAuthGuard', () => {

        it('answers 401 on every route without a session, except the public ones', async () => {
            const routes = setup.routes()
            expect(routes).toEqual(expect.arrayContaining(PUBLIC_ROUTES))

            for (const route of routes.filter((item) => !PUBLIC_ROUTES.includes(item))) {
                const [method, path] = route.split(' ')
                const response = await setup.as(null).request(method, path.replace(/:\w+/g, '1'), method === 'GET' ? undefined : {})

                expect(response, route).toEqual({ status: 401, body: { statusCode: 401, message: 'Unauthorized' } })
            }
        })

        it('lets the health routes through without a session', async () => {
            expect((await setup.as(null).get('/api/health')).status).toBe(200)
            expect((await setup.as(null).get('/api/health/version')).status).toBe(200)
        })

        it('lets every role use the routes: no route has a role rule yet (D13)', async () => {
            for (const role of Object.values(EpicUserRole)) {
                const session = await setup.loginAs(role)

                expect(await setup.as(session).get('/api/wafer-types'), role).toEqual({ status: 200, body: [] })
            }
        })

        it('refuses a user that the database knows no more', async () => {
            const session = await setup.loginAs(EpicUserRole.Developer)
            await setup.clearDatabase()

            expect((await setup.as(session).get('/api/wafer-types')).status).toBe(401)
        })

    })

    describe('the header svt_userId', () => {

        it('carries the user id on every request of a logged-in user to the DB agent', async () => {
            const expert = await setup.loginAs(EpicUserRole.Expert)
            const reader = new E2eRequestTopicReader(loadEpicApiE2eConfig().kafkaBroker)
            await reader.mark()

            expect((await setup.as(expert).get('/api/wafer-types')).status).toBe(200)
            expect((await setup.get('/api/wafer-types')).status).toBe(200)

            // The guard's own read of the Admin (its cache was cleared) goes too: it runs before the user is known.
            const ofWaferTypes = (all: E2eRequestRecord[]) => all
                .filter((record) => record.value.type === SvtDbAgentKafkaWaferTypes.MessageType.GetAllWaferTypes)
            const records = ofWaferTypes(await reader.read((all) => ofWaferTypes(all).length >= 2))
            expect(records.map((record) => [record.value.type, record.headers[SvtKafkaHeader.UserId]])).toEqual([
                [SvtDbAgentKafkaWaferTypes.MessageType.GetAllWaferTypes, String(expert.user.id)],
                [SvtDbAgentKafkaWaferTypes.MessageType.GetAllWaferTypes, String(E2E_ADMIN.id)],
            ])
        })

        it('is not on the GetUserCredentials request of a log-in, which carries no password either', async () => {
            const password = randomE2ePassword()
            await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User, password })
            const reader = new E2eRequestTopicReader(loadEpicApiE2eConfig().kafkaBroker)
            await reader.mark()

            await setup.login('jane.doe', password)

            const [record] = await reader.read((all) => all.length >= 1)
            expect(record.value).toEqual({ type: SvtDbAgentKafkaUsers.MessageType.GetUserCredentials, data: { login: 'jane.doe' } })
            expect(Object.keys(record.headers)).not.toContain(SvtKafkaHeader.UserId)
            expect(JSON.stringify(record)).not.toContain(password)
        })

    })

})
