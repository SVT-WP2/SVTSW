// @vitest-environment node
import { ServiceUnavailableException } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { firstValueFrom, NEVER, of, throwError } from 'rxjs'
import { EpicUserRole } from 'svt-ts-types'
import { EpicKafkaReplyStatus, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { EpicAuthConfig, EpicAuthSvc } from '../models'

import { EpicAuthUserCacheService } from './epic-auth-user-cache.service'
import { EpicAuthUsersService } from './epic-auth-users.service'


const JANE = {
    id: 7,
    login: 'jane.doe',
    name: 'Jane Doe',
    role: EpicUserRole.Expert,
    isActive: true,
    createdAt: '2026-11-26T12:00:00.000Z',
}

/** A `ClientKafka` whose `send` answers what the test queues, or never (`NEVER`). */
function fakeKafkaClient() {
    const send = vi.fn()
    return { client: { send, subscribeToResponseOf: vi.fn() } as unknown as ClientKafka, send }
}

const usersReply = (items: unknown[]) => of(
    new SvtDbAgentKafkaUsers.GetAllUsersReplyMessage({ items: items as never[], totalCount: items.length }),
)

describe('EpicAuthUsersService', () => {

    afterEach(() => {
        vi.useRealTimers()
    })

    it('answers 503 when the DB agent does not reply within the timeout, and not before', async () => {
        vi.useFakeTimers()
        const { client, send } = fakeKafkaClient()
        send.mockReturnValue(NEVER)
        const users = new EpicAuthUsersService(client)

        const result = firstValueFrom(users.getCredentials('jane.doe'))
        const outcome = vi.fn()
        void result.then(outcome, outcome)
        await vi.advanceTimersByTimeAsync(EpicAuthSvc.DB_AGENT_TIMEOUT_MS - 1)
        expect(outcome).not.toHaveBeenCalled()
        await vi.advanceTimersByTimeAsync(1)

        await expect(result).rejects.toBeInstanceOf(ServiceUnavailableException)
        await expect(result).rejects.toMatchObject({ status: 503, message: EpicAuthSvc.DB_AGENT_TIMEOUT_MESSAGE })
    })

    it('gives null for an unknown login, and the user with the hash for a known one', async () => {
        const { client, send } = fakeKafkaClient()
        const users = new EpicAuthUsersService(client)

        send.mockReturnValueOnce(of(new SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage(
            undefined, EpicKafkaReplyStatus.NotFound, { message: 'No user with this login' })))
        expect(await firstValueFrom(users.getCredentials('nobody'))).toBeNull()

        send.mockReturnValueOnce(of(new SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage({ entity: { ...JANE, passwordHash: 'h' } })))
        expect(await firstValueFrom(users.getCredentials('jane.doe'))).toEqual({ ...JANE, passwordHash: 'h' })
    })

})

describe('EpicAuthUserCacheService', () => {

    const config: EpicAuthConfig = {
        secret: 'x'.repeat(32),
        sessionHours: 12,
        cookieSecure: false,
        userCacheMs: 30_000,
        cookieName: 'svt_session',
    }

    afterEach(() => {
        vi.useRealTimers()
    })

    it('does not keep a read that failed: the next request reads again', async () => {
        const users = { getById: vi.fn() }
        users.getById
            .mockReturnValueOnce(throwError(() => new Error('reply error')))
            .mockReturnValueOnce(of(JANE))
        const cache = new EpicAuthUserCacheService(config, users as unknown as EpicAuthUsersService)

        await expect(cache.getActiveUser(7)).rejects.toThrow('reply error')
        await expect(cache.getActiveUser(7)).resolves.toEqual({ id: 7, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })
        expect(users.getById).toHaveBeenCalledTimes(2)
    })

    it('answers 503 for a read that times out, and does not keep it', async () => {
        vi.useFakeTimers()
        const { client, send } = fakeKafkaClient()
        send.mockReturnValueOnce(NEVER).mockReturnValueOnce(usersReply([JANE]))
        const cache = new EpicAuthUserCacheService(config, new EpicAuthUsersService(client))

        const first = cache.getActiveUser(7)
        first.catch(() => undefined)
        await vi.advanceTimersByTimeAsync(EpicAuthSvc.DB_AGENT_TIMEOUT_MS)

        await expect(first).rejects.toMatchObject({ status: 503 })
        await expect(cache.getActiveUser(7)).resolves.toMatchObject({ id: 7 })
        expect(send).toHaveBeenCalledTimes(2)
    })

    it('keeps a read that succeeded for the cache lifetime', async () => {
        const users = { getById: vi.fn(() => of(JANE)) }
        const cache = new EpicAuthUserCacheService(config, users as unknown as EpicAuthUsersService)

        await cache.getActiveUser(7)
        await cache.getActiveUser(7)

        expect(users.getById).toHaveBeenCalledTimes(1)
    })

})
