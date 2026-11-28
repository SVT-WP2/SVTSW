import { EpicUser, EpicUserRole } from 'svt-ts-types'
import { SvtDbAgentKafkaUsers, SvtKafkaHeader } from 'svt-ts-types/kafka'

import {
    E2E_ADMIN,
    E2eRequestRecord,
    E2eRequestTopicReader,
    E2eResponse,
    expectError,
    expectStatus,
    loadEpicApiE2eConfig,
    randomE2ePassword,
    TestSetup,
} from '../utils'


/** The text of the DB agent for a change that would leave no active Admin. */
const LAST_ADMIN = 'The installation must keep one active Admin'

/** The text of the DB agent for a duplicate value of a unique column (the login). */
const DUPLICATE = 'an entry with the same unique value already exists'

/** The type of a plain HTML form. */
const FORM = 'application/x-www-form-urlencoded'

/** The four routes of the user management, each with a valid body. */
const ADMIN_ROUTES: [method: string, path: string, body?: unknown][] = [
    ['GET', '/api/users'],
    ['POST', '/api/users', { login: 'new.user', name: 'New User', role: EpicUserRole.User, password: 'long-enough-1' }],
    ['PATCH', `/api/users/${E2E_ADMIN.id}`, { name: 'Renamed' }],
    ['POST', `/api/users/${E2E_ADMIN.id}/password`, { password: 'long-enough-1' }],
]

/** The keys of a response body, at any depth. */
function keysOf(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.flatMap(keysOf)
    }
    if (value !== null && typeof value === 'object') {
        return Object.entries(value).flatMap(([key, item]) => [key, ...keysOf(item)])
    }
    return []
}

function expectNoSecretKeys(response: E2eResponse): void {
    expect(keysOf(response.body), JSON.stringify(response.body)).not.toContain('passwordHash')
    expect(keysOf(response.body), JSON.stringify(response.body)).not.toContain('password')
}

describe('Users (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    /** The stored hash of a user. */
    async function storedHash(id: number): Promise<string> {
        const [row] = await setup.query<{ passwordHash: string }>('select "passwordHash" from main."SvtUser" where id = $1', [id])
        return row.passwordHash
    }

    /** The status of a log-in, without failing the test. */
    async function loginStatus(login: string, password: string): Promise<number> {
        return (await setup.as(null).post('/api/auth/login', { login, password })).status
    }

    describe('who may use the routes', () => {

        const otherRoles = [EpicUserRole.User, EpicUserRole.Expert, EpicUserRole.Developer]

        it.each(otherRoles)('answers 403 to %s on each route, and changes nothing', async (role) => {
            const session = await setup.loginAs(role)
            const before = await setup.query('select * from main."SvtUser" order by id')

            for (const [method, path, body] of ADMIN_ROUTES) {
                expectError(await setup.as(session).request(method, path, body), 403, 'Forbidden')
            }

            expect(await setup.query('select * from main."SvtUser" order by id')).toEqual(before)
        })

        it('answers 401 on each route without a session', async () => {
            for (const [method, path, body] of ADMIN_ROUTES) {
                expect(await setup.as(null).request(method, path, body), `${method} ${path}`)
                    .toEqual({ status: 401, body: { statusCode: 401, message: 'Unauthorized' } })
            }
        })

    })

    describe('GET /api/users', () => {

        it('answers every user, active or not, in ascending order of id, without a hash', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })
            const off = await setup.createUser({ login: 'switched.off', name: 'Off', role: EpicUserRole.User, isActive: false })

            const response = await setup.get<EpicUser[]>('/api/users')

            const users = expectStatus(response, 200)
            expect(users.map(({ id, login, name, role, isActive }) => ({ id, login, name, role, isActive }))).toEqual([
                { ...E2E_ADMIN, isActive: true },
                { id: jane.id, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert, isActive: true },
                { id: off.id, login: 'switched.off', name: 'Off', role: EpicUserRole.User, isActive: false },
            ])
            for (const user of users) {
                expect(Object.keys(user)).toEqual(['id', 'login', 'name', 'role', 'isActive', 'createdAt'])
                expect(new Date(user.createdAt).toISOString()).toBe(user.createdAt)
            }
            expectNoSecretKeys(response)
        })

    })

    describe('POST /api/users', () => {

        it('answers 201 with the new active user; the row holds a hash that is not the password; the user can log in', async () => {
            const password = randomE2ePassword()

            const body = { login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert, password }

            const response = await setup.post<EpicUser>('/api/users', body)

            const user = expectStatus(response, 201)
            expect(user).toEqual({
                id: 2,
                login: 'jane.doe',
                name: 'Jane Doe',
                role: EpicUserRole.Expert,
                isActive: true,
                createdAt: expect.any(String),
            })
            expectNoSecretKeys(response)
            const hash = await storedHash(user.id)
            expect(hash).toMatch(/^scrypt\$/)
            expect(hash).not.toContain(password)
            const session = await setup.login('jane.doe', password)
            expect(session.user).toEqual({ id: user.id, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })
        })

        it('trims the login and puts it in lower case before it is sent', async () => {
            const password = randomE2ePassword()

            const body = { login: '  Jane.DOE ', name: 'Jane', role: EpicUserRole.User, password }

            const response = await setup.post<EpicUser>('/api/users', body)

            const user = expectStatus(response, 201)

            expect(user.login).toBe('jane.doe')
            expect((await setup.login('jane.doe', password)).user.id).toBe(user.id)
        })

        it('sends CreateUser with the hash, never the password, and the svt_userId of the Admin', async () => {
            const password = randomE2ePassword()
            const reader = new E2eRequestTopicReader(loadEpicApiE2eConfig().kafkaBroker)
            await reader.mark()

            expectStatus(await setup.post('/api/users', { login: 'jane.doe', name: 'Jane', role: EpicUserRole.User, password }), 201)

            const ofCreate = (all: E2eRequestRecord[]) => all
                .filter((record) => record.value.type === SvtDbAgentKafkaUsers.MessageType.CreateUser)
            const [record] = ofCreate(await reader.read((all) => ofCreate(all).length >= 1))
            expect(record.headers[SvtKafkaHeader.UserId]).toBe(String(E2E_ADMIN.id))
            expect(record.value).toEqual({
                type: SvtDbAgentKafkaUsers.MessageType.CreateUser,
                data: {
                    create: { login: 'jane.doe', name: 'Jane', role: EpicUserRole.User, passwordHash: expect.stringMatching(/^scrypt\$/) },
                },
            })
            expect(JSON.stringify(record)).not.toContain(password)
        })

        it('answers 400 with the text of the DB agent for a login that exists in another case', async () => {
            await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })

            const body = { login: 'JANE.Doe', name: 'Other', role: EpicUserRole.User, password: randomE2ePassword() }

            const response = await setup.post('/api/users', body)

            expectError(response, 400, DUPLICATE)
            expect(await setup.count('SvtUser')).toBe(2)
        })

        it('answers 400 for a password of 7 characters or of 129, and creates nothing', async () => {
            for (const password of ['x'.repeat(7), 'x'.repeat(129)]) {
                const response = await setup.post('/api/users', { login: 'jane.doe', name: 'Jane', role: EpicUserRole.User, password })

                expectError(response, 400, 'password must be')
                expectNoSecretKeys(response)
            }
            expect(await setup.count('SvtUser')).toBe(1)
        })

        it('accepts a password of 8 characters and one of 128', async () => {
            for (const [index, password] of ['x'.repeat(8), 'y'.repeat(128)].entries()) {
                const body = { login: `user-${index}`, name: 'User', role: EpicUserRole.User, password }

                expectStatus(await setup.post('/api/users', body), 201)

                expect(await loginStatus(`user-${index}`, password)).toBe(200)
            }
        })

        it('answers 400 for a role that does not exist, and for a missing name, login or password', async () => {
            const valid = { login: 'jane.doe', name: 'Jane', role: EpicUserRole.User, password: randomE2ePassword() }

            expectError(await setup.post('/api/users', { ...valid, role: 'Superuser' }), 400, 'role must be one of the following values')
            expectError(await setup.post('/api/users', { ...valid, role: 'admin' }), 400, 'role must be one of the following values')
            expectError(await setup.post('/api/users', { ...valid, name: undefined }), 400, 'name must be a string')
            expectError(await setup.post('/api/users', { ...valid, login: 42 }), 400, 'login must be a string')
            expectError(await setup.post('/api/users', { ...valid, password: 12345678 }), 400, 'password must be a string')
            expectError(await setup.post('/api/users', { ...valid, login: 'x'.repeat(101) }), 400, 'login must be shorter')
            expectError(await setup.post('/api/users', { ...valid, name: 'x'.repeat(1001) }), 400, 'name must be shorter')
            expect(await setup.count('SvtUser')).toBe(1)
        })

        it('answers 400 with the text of the DB agent for a login that breaks the login rule, and an empty name', async () => {
            const valid = { login: 'jane.doe', name: 'Jane', role: EpicUserRole.User, password: randomE2ePassword() }

            expectError(await setup.post('/api/users', { ...valid, login: 'ab' }), 400, 'login')
            expectError(await setup.post('/api/users', { ...valid, login: 'jane doe' }), 400, 'login')
            expectError(await setup.post('/api/users', { ...valid, name: '   ' }), 400, 'name must be 1 to 100 characters long')
            expect(await setup.count('SvtUser')).toBe(1)
        })

    })

    describe('PATCH /api/users/:id', () => {

        it('changes the name and the role; the user has the new role with its next request (the cache was dropped)', async () => {
            const session = await setup.loginAs(EpicUserRole.User)
            expect((await setup.as(session).get('/api/auth/me')).body.role).toBe(EpicUserRole.User)

            const response = await setup.patch<EpicUser>(`/api/users/${session.user.id}`, { name: 'Renamed', role: EpicUserRole.Developer })

            expect(expectStatus(response, 200))
                .toMatchObject({ id: session.user.id, name: 'Renamed', role: EpicUserRole.Developer, isActive: true })
            expectNoSecretKeys(response)
            expect(await setup.as(session).get('/api/auth/me')).toEqual({
                status: 200,
                body: { ...session.user, name: 'Renamed', role: EpicUserRole.Developer },
            })
        })

        it('keeps what the body does not name, and cannot change the login', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })

            const response = await setup.patch<EpicUser>(`/api/users/${jane.id}`, { login: 'other.login' })

            expect(expectStatus(response, 200))
                .toMatchObject({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert, isActive: true })
        })

        it('switches a user off: its next request is 401 and its log-in fails; switched on again, it logs in', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })
            const session = await setup.login('jane.doe', jane.password)
            expect((await setup.as(session).get('/api/auth/me')).status).toBe(200)

            const off = await setup.patch<EpicUser>(`/api/users/${jane.id}`, { isActive: false })

            expect(expectStatus(off, 200).isActive).toBe(false)
            expect((await setup.as(session).get('/api/auth/me')).status).toBe(401)
            expect(await loginStatus('jane.doe', jane.password)).toBe(401)
            const listed = expectStatus(await setup.get<EpicUser[]>('/api/users'), 200).find((user) => user.id === jane.id)
            expect(listed?.isActive).toBe(false)

            expect(expectStatus(await setup.patch<EpicUser>(`/api/users/${jane.id}`, { isActive: true }), 200).isActive).toBe(true)
            expect(await loginStatus('jane.doe', jane.password)).toBe(200)
        })

        it('answers 400 with the text of the DB agent when the only active Admin is switched off or gets another role', async () => {
            expectError(await setup.patch(`/api/users/${E2E_ADMIN.id}`, { isActive: false }), 400, LAST_ADMIN)
            expectError(await setup.patch(`/api/users/${E2E_ADMIN.id}`, { role: EpicUserRole.Developer }), 400, LAST_ADMIN)

            expect(await setup.get('/api/auth/me')).toEqual({ status: 200, body: E2E_ADMIN })
        })

        it('lets an Admin switch off another Admin while one active Admin stays', async () => {
            const other = await setup.createUser({ login: 'second.admin', name: 'Second Admin', role: EpicUserRole.Admin })

            expect(expectStatus(await setup.patch<EpicUser>(`/api/users/${other.id}`, { isActive: false }), 200).isActive).toBe(false)
            expectError(await setup.patch(`/api/users/${E2E_ADMIN.id}`, { role: EpicUserRole.User }), 400, LAST_ADMIN)
        })

        it('answers 404 for an unknown id, and 400 for an id that is no number', async () => {
            expectError(await setup.patch('/api/users/999', { name: 'Nobody' }), 404, 'No user with id 999')
            expectError(await setup.patch('/api/users/abc', { name: 'Nobody' }), 400, 'numeric string is expected')
        })

        it('answers 400 for values of the wrong type, without converting them ("false" is no boolean)', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })

            expectError(await setup.patch(`/api/users/${jane.id}`, { isActive: 'false' }), 400, 'isActive must be a boolean value')
            expectError(await setup.patch(`/api/users/${jane.id}`, { isActive: 0 }), 400, 'isActive must be a boolean value')
            expectError(await setup.patch(`/api/users/${jane.id}`, { role: 'Root' }), 400, 'role must be one of the following values')
            expectError(await setup.patch(`/api/users/${jane.id}`, { name: 42 }), 400, 'name must be a string')

            expect(await loginStatus('jane.doe', jane.password)).toBe(200)
        })

    })

    describe('POST /api/users/:id/password', () => {

        it('sets a new password: the old one fails, the new one works; the hash in the row changes', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
            const hashBefore = await storedHash(jane.id)
            const password = randomE2ePassword()

            const response = await setup.post<EpicUser>(`/api/users/${jane.id}/password`, { password })

            expect(expectStatus(response, 201)).toMatchObject({ id: jane.id, login: 'jane.doe', isActive: true })
            expectNoSecretKeys(response)
            expect(await storedHash(jane.id)).not.toBe(hashBefore)
            expect(await storedHash(jane.id)).not.toContain(password)
            expect(await loginStatus('jane.doe', jane.password)).toBe(401)
            expect(await loginStatus('jane.doe', password)).toBe(200)
        })

        it('lets an Admin set the own password without the current one', async () => {
            const password = randomE2ePassword()

            expectStatus(await setup.post(`/api/users/${E2E_ADMIN.id}/password`, { password }), 201)

            expect(await loginStatus(E2E_ADMIN.login, password)).toBe(200)
            expect((await setup.get('/api/auth/me')).status).toBe(200)
        })

        it('answers 400 for a password of 7 characters, 404 for an unknown id', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })

            expectError(await setup.post(`/api/users/${jane.id}/password`, { password: 'x'.repeat(7) }), 400, 'password must be')
            expectError(await setup.post('/api/users/999/password', { password: randomE2ePassword() }), 404, 'No user with id 999')

            expect(await loginStatus('jane.doe', jane.password)).toBe(200)
        })

    })

    describe('POST /api/auth/password', () => {

        it('answers 400 to a wrong current password; the right one changes it, and the session stays valid', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
            const session = await setup.login('jane.doe', jane.password)
            const newPassword = randomE2ePassword()

            const wrong = await setup.as(session).post('/api/auth/password', { currentPassword: `${jane.password}x`, newPassword })

            expectError(wrong, 400, 'The current password is wrong.')
            expect(await loginStatus('jane.doe', jane.password)).toBe(200)

            const right = await setup.as(session).post('/api/auth/password', { currentPassword: jane.password, newPassword })

            expect(right).toEqual({ status: 204, body: undefined })
            expect(await loginStatus('jane.doe', jane.password)).toBe(401)
            expect(await loginStatus('jane.doe', newPassword)).toBe(200)
            expect((await setup.as(session).get('/api/auth/me')).status).toBe(200)
        })

        it('works for every role, and changes only the own password', async () => {
            const other = await setup.createUser({ login: 'other.user', name: 'Other', role: EpicUserRole.User })
            for (const role of Object.values(EpicUserRole)) {
                const user = await setup.createUser({ login: `own-${role.toLowerCase()}`, name: role, role })
                const session = await setup.login(user.login, user.password)
                const newPassword = randomE2ePassword()

                const response = await setup.as(session).post('/api/auth/password', { currentPassword: user.password, newPassword })

                expect(response.status, role).toBe(204)
                expect(await loginStatus(user.login, newPassword), role).toBe(200)
            }
            expect(await loginStatus('other.user', other.password)).toBe(200)
        })

        it('counts a wrong current password as a failed log-in of the login: after five, 429 also for the log-in', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
            const session = await setup.login('jane.doe', jane.password)
            const body = { currentPassword: 'wrong-password', newPassword: randomE2ePassword() }

            for (let attempt = 1; attempt <= 5; attempt++) {
                expect((await setup.as(session).post('/api/auth/password', body)).status, `attempt ${attempt}`).toBe(400)
            }
            const locked = await setup.fetch('POST', '/api/auth/password', {
                body: { ...body, currentPassword: jane.password },
                cookie: session.cookie,
            })

            expect(locked.status).toBe(429)
            expect(Number(locked.headers.get('retry-after'))).toBeGreaterThan(0)
            expect(await loginStatus('jane.doe', jane.password)).toBe(429)
        })

        it('answers 400 for a new password of 7 characters, and keeps the old one', async () => {
            const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
            const session = await setup.login('jane.doe', jane.password)

            const body = { currentPassword: jane.password, newPassword: 'x'.repeat(7) }

            const response = await setup.as(session).post('/api/auth/password', body)

            expectError(response, 400, 'newPassword must be')
            expect(await loginStatus('jane.doe', jane.password)).toBe(200)
        })

        it('answers 401 without a session', async () => {
            expect(await setup.as(null).post('/api/auth/password', { currentPassword: 'x', newPassword: randomE2ePassword() }))
                .toEqual({ status: 401, body: { statusCode: 401, message: 'Unauthorized' } })
        })

    })

    describe('a forged form post (cross-site request forgery)', () => {

        /** A request of the Admin's browser with the Admin's cookie and a body that a plain HTML form can send. */
        function formPost(method: string, path: string, body: string, contentType = FORM): Promise<Response> {
            return setup.fetch(method, path, { body, contentType, cookie: setup.admin.cookie })
        }

        it('creates no Admin and sets no password from a url-encoded form: 415', async () => {
            const created = await formPost('POST', '/api/users', 'login=evil&name=Evil&role=Admin&password=evil-password')
            const password = await formPost('POST', `/api/users/${E2E_ADMIN.id}/password`, 'password=evil-password')
            const json = JSON.stringify({ login: 'evil', name: 'Evil', role: EpicUserRole.Admin, password: 'evil-password' })
            const asText = await formPost('POST', '/api/users', json, 'text/plain')

            expect([created.status, password.status, asText.status]).toEqual([415, 415, 415])
            expect(await setup.count('SvtUser')).toBe(1)
            expect(await loginStatus('evil', 'evil-password')).toBe(401)
            expect(await loginStatus(E2E_ADMIN.login, 'evil-password')).toBe(401)
        })

        it('answers 415 on every route that changes something, before the guard', async () => {
            const routes = setup.routes().filter((route) => !route.startsWith('GET '))

            for (const route of routes) {
                const [method, path] = route.split(' ')
                const response = await formPost(method, path.replace(/:\w+/g, '1'), 'a=1')

                expect(response.status, route).toBe(415)
            }
        })

    })

    it('holds the key passwordHash or password in no response body of the five routes, also in their errors', async () => {
        const jane = await setup.createUser({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
        const session = await setup.login('jane.doe', jane.password)
        const password = randomE2ePassword()

        const responses = [
            await setup.get('/api/users'),
            await setup.post('/api/users', { login: 'new.user', name: 'New', role: EpicUserRole.User, password }),
            await setup.post('/api/users', { login: 'new.user', name: 'New', role: EpicUserRole.User, password }),
            await setup.patch(`/api/users/${jane.id}`, { name: 'Jane' }),
            await setup.patch(`/api/users/${E2E_ADMIN.id}`, { isActive: false }),
            await setup.post(`/api/users/${jane.id}/password`, { password }),
            await setup.post(`/api/users/${jane.id}/password`, { password: 'short' }),
            await setup.as(session).post('/api/auth/password', { currentPassword: 'wrong-password', newPassword: password }),
            await setup.as(session).post('/api/auth/password', { currentPassword: password, newPassword: randomE2ePassword() }),
        ]

        expect(responses.map((response) => response.status)).toEqual([200, 201, 400, 200, 400, 201, 400, 400, 204])
        for (const response of responses) {
            expectNoSecretKeys(response)
            expect(JSON.stringify(response.body ?? null)).not.toContain(password)
        }
    })

})
