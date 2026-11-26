// @vitest-environment node
import { IncomingMessage } from 'node:http'

import { EpicUserRole } from 'svt-ts-types'

import { EpicAuthSessionService, EpicAuthUserCacheService } from '../auth'

import { IvMntGateway } from './iv-mnt.gateway'


describe('IvMntGateway', () => {

    const userCache = { getActiveUser: vi.fn() }
    const session = new EpicAuthSessionService({
        secret: 'x'.repeat(32),
        sessionHours: 1,
        cookieSecure: false,
        userCacheMs: 0,
        cookieName: 'svt_session',
    })
    const gateway = new IvMntGateway(session, userCache as unknown as EpicAuthUserCacheService)

    const socket = () => {
        const close = vi.fn()
        return { client: { close, send: vi.fn() } as unknown as WebSocket, close }
    }
    const upgrade = (cookie?: string) => ({ headers: cookie === undefined ? {} : { cookie } }) as IncomingMessage

    beforeEach(() => {
        vi.useFakeTimers()
        userCache.getActiveUser.mockReset()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('closes a socket without a session cookie, or with a token that does not verify', async () => {
        for (const request of [upgrade(), upgrade('other=1'), upgrade('svt_session=forged')]) {
            const { client, close } = socket()

            await gateway.handleConnection(client, request)

            expect(close).toHaveBeenCalledWith(4401, 'Unauthorized')
        }
        expect(userCache.getActiveUser).not.toHaveBeenCalled()
    })

    it('closes a socket of a user that is unknown or switched off', async () => {
        userCache.getActiveUser.mockResolvedValue(null)
        const { client, close } = socket()

        await gateway.handleConnection(client, upgrade(`a=b; svt_session=${session.sign(3)}`))

        expect(userCache.getActiveUser).toHaveBeenCalledWith(3)
        expect(close).toHaveBeenCalledWith(4401, 'Unauthorized')
    })

    it('keeps the socket of an active user', async () => {
        userCache.getActiveUser.mockResolvedValue({ id: 3, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.User })
        const { client, close } = socket()

        await gateway.handleConnection(client, upgrade(`svt_session=${session.sign(3)}`))

        expect(close).not.toHaveBeenCalled()
    })

})
