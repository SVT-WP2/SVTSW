// @vitest-environment node
import { ClientKafka } from '@nestjs/microservices'
import { hashEpicPassword } from 'epic/core'
import { of } from 'rxjs'
import { EpicUser, EpicUserRole } from 'svt-ts-types'
import { EpicKafkaReplyStatus, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { EpicAuthUserCacheService } from '../../auth'

import { EpicUsersService } from './epic-users.service'


vi.mock('epic/core', () => ({
    hashEpicPassword: vi.fn(() => Promise.resolve('hash-of-the-password')),
}))

const JANE: EpicUser = {
    id: 7,
    login: 'jane.doe',
    name: 'Jane Doe',
    role: EpicUserRole.Expert,
    isActive: true,
    createdAt: '2026-11-27T12:00:00.000Z',
}

describe('EpicUsersService', () => {

    let send: ReturnType<typeof vi.fn>
    let forget: ReturnType<typeof vi.fn>
    let service: EpicUsersService

    beforeEach(() => {
        vi.mocked(hashEpicPassword).mockClear()
        send = vi.fn()
        forget = vi.fn()
        service = new EpicUsersService(
            { send, subscribeToResponseOf: vi.fn() } as unknown as ClientKafka,
            { forget } as unknown as EpicAuthUserCacheService,
        )
    })

    /** The messages the service sent, parsed. */
    function sentMessages(): { type: string; data: Record<string, unknown> }[] {
        return send.mock.calls.map(([, record]: [string, { value: string }]) => JSON.parse(record.value))
    }

    it('creates a user with the login trimmed and in lower case, and sends only the hash of the password', async () => {
        send.mockReturnValue(of(new SvtDbAgentKafkaUsers.CreateUserReplyMessage({ entity: JANE })))

        const user = await service.create({ login: '  Jane.DOE ', name: 'Jane Doe', role: EpicUserRole.Expert, password: 'plain-password' })

        expect(user).toEqual(JANE)
        expect(hashEpicPassword).toHaveBeenCalledWith('plain-password')
        expect(sentMessages()).toEqual([{
            type: 'CreateUser',
            data: { create: { login: 'jane.doe', name: 'Jane Doe', role: 'Expert', passwordHash: 'hash-of-the-password' } },
        }])
        expect(JSON.stringify(send.mock.calls)).not.toContain('plain-password')
    })

    it('answers exactly the keys of EpicUser, whatever else a reply holds', async () => {
        const withHash = { ...JANE, passwordHash: 'a-hash', extra: 1 }
        send.mockReturnValueOnce(of(new SvtDbAgentKafkaUsers.GetAllUsersReplyMessage({ items: [withHash], totalCount: 1 })))
            .mockReturnValueOnce(of(new SvtDbAgentKafkaUsers.UpdateUserReplyMessage({ entity: withHash })))

        expect(await service.getAll()).toEqual([JANE])
        expect(Object.keys(await service.update(7, { name: 'Jane' }))).toEqual(['id', 'login', 'name', 'role', 'isActive', 'createdAt'])
    })

    it('sends only the keys of the update, and drops the user from the cache of the guard', async () => {
        send.mockReturnValue(of(new SvtDbAgentKafkaUsers.UpdateUserReplyMessage({ entity: JANE })))

        await service.update(7, { isActive: false })

        expect(sentMessages()).toEqual([{ type: 'UpdateUser', data: { id: 7, update: { isActive: false } } }])
        expect(forget).toHaveBeenCalledWith(7)
    })

    it('drops the user from the cache also when the DB agent refuses the change', async () => {
        send.mockReturnValue(of(new SvtDbAgentKafkaUsers.UpdateUserReplyMessage(
            undefined, EpicKafkaReplyStatus.BadRequest, { message: 'The installation must keep one active Admin' })))

        await expect(service.update(7, { role: EpicUserRole.User })).rejects.toMatchObject({ status: EpicKafkaReplyStatus.BadRequest })

        expect(forget).toHaveBeenCalledWith(7)
    })

    it('sets a password with its hash only, and drops the user from the cache', async () => {
        send.mockReturnValue(of(new SvtDbAgentKafkaUsers.UpdateUserPasswordReplyMessage({ entity: JANE })))

        expect(await service.setPassword(7, 'plain-password')).toEqual(JANE)

        expect(sentMessages()).toEqual([{ type: 'UpdateUserPassword', data: { id: 7, passwordHash: 'hash-of-the-password' } }])
        expect(JSON.stringify(send.mock.calls)).not.toContain('plain-password')
        expect(forget).toHaveBeenCalledWith(7)
    })

})
