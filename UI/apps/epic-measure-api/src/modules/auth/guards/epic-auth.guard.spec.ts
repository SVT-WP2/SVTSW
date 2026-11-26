// @vitest-environment node
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'

import { EpicRequestContext } from '../../../common'
import { EpicPublic, EpicRoles } from '../decorators'
import { EpicAuthRequest } from '../models'
import { EpicAuthSessionService, EpicAuthUserCacheService } from '../services'

import { EpicAuthGuard } from './epic-auth.guard'


const ROLES = [EpicUserRole.User, EpicUserRole.Expert, EpicUserRole.Developer, EpicUserRole.Admin]

class OpenController {

    route(): void {}

}

/** `@EpicRoles` on a controller, and once on a method that overrides it. */
@EpicRoles(EpicUserRole.Admin)
class AdminOnlyController {

    @EpicRoles(EpicUserRole.Expert)
    expertRoute(): void {}

    route(): void {}

}

@EpicPublic()
class PublicController {

    route(): void {}

}

function httpContext(request: Partial<EpicAuthRequest>, controller: object, handler: () => void): ExecutionContext {
    return {
        getType: () => 'http',
        getClass: () => controller,
        getHandler: () => handler,
        switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext
}

describe('EpicAuthGuard', () => {

    const user = (role: EpicUserRole): EpicAuthUser => ({ id: 7, login: 'jane.doe', name: 'Jane Doe', role })

    let session: { verify: ReturnType<typeof vi.fn>; readToken: ReturnType<typeof vi.fn> }
    let userCache: { getActiveUser: ReturnType<typeof vi.fn> }
    let guard: EpicAuthGuard

    beforeEach(() => {
        session = {
            readToken: vi.fn((request: EpicAuthRequest) => (request.cookies as Record<string, string>)?.['svt_session']),
            verify: vi.fn((token: unknown) => (token === 'valid' ? 7 : null)),
        }
        userCache = { getActiveUser: vi.fn(() => Promise.resolve(user(EpicUserRole.User))) }
        guard = new EpicAuthGuard(
            new Reflector(),
            session as unknown as EpicAuthSessionService,
            userCache as unknown as EpicAuthUserCacheService,
        )
    })

    function activate(request: Partial<EpicAuthRequest>, controller: { prototype: object }, handlerName = 'route'): Promise<boolean> {
        const handler = (controller.prototype as Record<string, () => void>)[handlerName]
        return EpicRequestContext.run(() => guard.canActivate(httpContext(request, controller, handler)))
    }

    it('lets a public route through without a session, and reads no user', async () => {
        await expect(activate({ cookies: {} }, PublicController)).resolves.toBe(true)
        expect(userCache.getActiveUser).not.toHaveBeenCalled()
    })

    it('refuses a route without a cookie, or with a token that does not verify: 401', async () => {
        await expect(activate({ cookies: {} }, OpenController)).rejects.toThrow(UnauthorizedException)
        await expect(activate({}, OpenController)).rejects.toThrow(UnauthorizedException)
        await expect(activate({ cookies: { svt_session: 'forged' } }, OpenController)).rejects.toThrow(UnauthorizedException)
        expect(userCache.getActiveUser).not.toHaveBeenCalled()
    })

    it('refuses a valid token of a user that is unknown or switched off: 401', async () => {
        userCache.getActiveUser.mockResolvedValue(null)

        await expect(activate({ cookies: { svt_session: 'valid' } }, OpenController)).rejects.toThrow(UnauthorizedException)
        expect(userCache.getActiveUser).toHaveBeenCalledWith(7)
    })

    it('puts the user on the request and into the request context', async () => {
        const request: Partial<EpicAuthRequest> = { cookies: { svt_session: 'valid' } }
        const handler = (OpenController.prototype as unknown as Record<string, () => void>)['route']

        const userId = await EpicRequestContext.run(async () => {
            await guard.canActivate(httpContext(request, OpenController, handler))
            return EpicRequestContext.getUserId()
        })

        expect(request.user).toEqual(user(EpicUserRole.User))
        expect(userId).toBe(7)
    })

    it('lets every other kind of context through (WebSocket, Kafka): they check on their own', async () => {
        const context = { getType: () => 'rpc' } as unknown as ExecutionContext

        await expect(guard.canActivate(context)).resolves.toBe(true)
    })

    describe('@EpicRoles', () => {

        const cases = ROLES.flatMap((role, level) => ROLES.map((minimum, minimumLevel) => ({
            role,
            minimum,
            allowed: level >= minimumLevel,
        })))

        it.each(cases)('$role against the minimum $minimum: allowed $allowed', async ({ role, minimum, allowed }) => {
            userCache.getActiveUser.mockResolvedValue(user(role))
            const controller = class {

                route(): void {}

            }
            EpicRoles(minimum)(controller)

            const result = activate({ cookies: { svt_session: 'valid' } }, controller)

            if (allowed) {
                await expect(result).resolves.toBe(true)
            }
            else {
                await expect(result).rejects.toThrow(ForbiddenException)
            }
        })

        it('a method decorator wins over the controller decorator', async () => {
            userCache.getActiveUser.mockResolvedValue(user(EpicUserRole.Expert))

            await expect(activate({ cookies: { svt_session: 'valid' } }, AdminOnlyController, 'expertRoute')).resolves.toBe(true)
            await expect(activate({ cookies: { svt_session: 'valid' } }, AdminOnlyController)).rejects.toThrow(ForbiddenException)
        })

        it('a route without the decorator is open to every role', async () => {
            for (const role of ROLES) {
                userCache.getActiveUser.mockResolvedValue(user(role))

                await expect(activate({ cookies: { svt_session: 'valid' } }, OpenController)).resolves.toBe(true)
            }
        })

        it('refuses a user whose role is no role at all', async () => {
            userCache.getActiveUser.mockResolvedValue(user('Operator' as EpicUserRole))
            const controller = class {

                route(): void {}

            }
            EpicRoles(EpicUserRole.User)(controller)

            await expect(activate({ cookies: { svt_session: 'valid' } }, controller)).rejects.toThrow(ForbiddenException)
        })

    })

})
