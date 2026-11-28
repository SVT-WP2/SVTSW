// @vitest-environment node
import { of } from 'rxjs'
import { EpicUser, EpicUserRole } from 'svt-ts-types'

import { EpicAuthConfig } from '../models'

import { EpicAuthUserCacheService } from './epic-auth-user-cache.service'
import { EpicAuthUsersService } from './epic-auth-users.service'


const JANE: EpicUser = {
    id: 7,
    login: 'jane.doe',
    name: 'Jane Doe',
    role: EpicUserRole.Expert,
    isActive: true,
    createdAt: '2026-11-27T12:00:00.000Z',
}

describe('EpicAuthUserCacheService', () => {

    const config = { userCacheMs: 30_000 } as EpicAuthConfig
    let getById: ReturnType<typeof vi.fn>
    let cache: EpicAuthUserCacheService

    beforeEach(() => {
        getById = vi.fn(() => of({ ...JANE, isActive: false }))
        cache = new EpicAuthUserCacheService(config, { getById } as unknown as EpicAuthUsersService)
    })

    it('answers a remembered user without reading it', async () => {
        cache.remember(JANE)

        expect(await cache.getActiveUser(7)).toEqual({ id: 7, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })
        expect(getById).not.toHaveBeenCalled()
    })

    it('reads a user again after forget', async () => {
        cache.remember(JANE)

        cache.forget(7)

        expect(await cache.getActiveUser(7)).toBeNull()
        expect(getById).toHaveBeenCalledWith(7)
    })

    it('does not keep a user that a log-in read before a change of that user (switched off during the log-in)', async () => {
        const readMark = cache.mark()
        cache.forget(7)

        cache.remember(JANE, readMark)

        expect(await cache.getActiveUser(7)).toBeNull()
        expect(getById).toHaveBeenCalledTimes(1)
    })

    it('keeps a user read after the last change, and the users of other ids', async () => {
        cache.forget(7)
        const readMark = cache.mark()

        cache.remember(JANE, readMark)
        cache.remember({ ...JANE, id: 8 }, readMark - 5)

        expect(await cache.getActiveUser(7)).not.toBeNull()
        expect(await cache.getActiveUser(8)).not.toBeNull()
        expect(getById).not.toHaveBeenCalled()
    })

    it('forgets the changes too at clear', async () => {
        const readMark = cache.mark()
        cache.forget(7)

        cache.clear()
        cache.remember(JANE, readMark)

        expect(await cache.getActiveUser(7)).not.toBeNull()
    })

})
