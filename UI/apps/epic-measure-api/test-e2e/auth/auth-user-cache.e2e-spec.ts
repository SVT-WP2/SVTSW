import { EpicUserRole } from 'svt-ts-types'

import { TestSetup } from '../utils'


/** The lifetime of the guard's user cache in this file: a setting, so the spec does not wait the default 30 s. */
const CACHE_SECONDS = 2

/**
 * A file of its own: the BFF reads the setting at boot, and two BFFs in one file would share the consumer groups of
 * their Kafka clients.
 */
describe('Auth: the user cache of the guard (e2e)', () => {

    const setup = new TestSetup()
    const previous = process.env.SVT_UI_AUTH_USER_CACHE_SECONDS

    beforeAll(() => {
        process.env.SVT_UI_AUTH_USER_CACHE_SECONDS = String(CACHE_SECONDS)
        return setup.init()
    })
    afterAll(async () => {
        await setup.close()
        process.env.SVT_UI_AUTH_USER_CACHE_SECONDS = previous
    })
    beforeEach(() => setup.clearDatabase())

    it('a user switched off in the database loses access once the cache lifetime has passed', async () => {
        // The log-in puts the user into the cache.
        const session = await setup.loginAs(EpicUserRole.Expert)
        const cachedAt = Date.now()
        expect((await setup.as(session).get('/api/wafer-types')).status).toBe(200)

        await setup.query('update main."SvtUser" set "isActive" = false where id = $1', [session.user.id])
        const cached = await setup.as(session).get('/api/wafer-types')
        if (Date.now() - cachedAt < CACHE_SECONDS * 1000 / 2) {
            // Within the lifetime the cache still answers; checked only when the machine was quick enough to tell.
            expect(cached.status).toBe(200)
        }
        await new Promise((resolve) => setTimeout(resolve, CACHE_SECONDS * 1000 + 200))

        expect((await setup.as(session).get('/api/wafer-types')).status).toBe(401)
        expect((await setup.as(session).get('/api/auth/me')).status).toBe(401)
    })

    it('a user whose role changes in the database gets the new role once the cache lifetime has passed', async () => {
        const session = await setup.loginAs(EpicUserRole.User)
        await setup.query('update main."SvtUser" set role = $2 where id = $1', [session.user.id, EpicUserRole.Developer])

        await new Promise((resolve) => setTimeout(resolve, CACHE_SECONDS * 1000 + 200))

        expect((await setup.as(session).get('/api/auth/me')).body).toEqual({ ...session.user, role: EpicUserRole.Developer })
    })

})
