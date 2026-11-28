import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { EpicUserRole, isEpicUserRoleAtLeast } from 'svt-ts-types'

import { EpicRequestContext } from '../../../common'
import { EpicAuthMetadata } from '../decorators'
import { EpicAuthRequest } from '../models'
import { EpicAuthSessionService, EpicAuthUserCacheService } from '../services'


/**
 * The global guard of the BFF (`APP_GUARD`). Every HTTP route needs a valid session unless it is marked
 * `@EpicPublic()`:
 *
 * 1. a public route passes;
 * 2. the cookie `svt_session` must hold a valid token (signature, expiry): else `401`;
 * 3. the user of the token must exist and be active (read through `EpicAuthUserCacheService`): else `401`;
 * 4. the user goes onto the request (`request.user`) and into the request context, so every Kafka request of this
 *    HTTP request carries `svt_userId`;
 * 5. a route marked `@EpicRoles(minimum)` needs that role or a higher one: else `403`.
 *
 * The guard covers HTTP only. The WebSocket gateway checks the cookie itself when a socket connects, and the Kafka
 * handlers of the BFF get their messages from the broker (ticket 392, D12).
 */
@Injectable()
export class EpicAuthGuard implements CanActivate {

    constructor(
        private readonly reflector: Reflector,
        private readonly session: EpicAuthSessionService,
        private readonly userCache: EpicAuthUserCacheService,
    ) {
    }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        if (context.getType() !== 'http') {
            return true
        }
        const targets = [context.getHandler(), context.getClass()]
        if (this.reflector.getAllAndOverride<boolean | undefined>(EpicAuthMetadata.PUBLIC, targets)) {
            return true
        }

        const request = context.switchToHttp().getRequest<EpicAuthRequest>()
        const userId = this.session.verify(this.session.readToken(request))
        if (userId === null) {
            throw new UnauthorizedException()
        }
        const user = await this.userCache.getActiveUser(userId)
        if (!user) {
            throw new UnauthorizedException()
        }
        request.user = user
        EpicRequestContext.setUserId(user.id)

        const minimum = this.reflector.getAllAndOverride<EpicUserRole | undefined>(EpicAuthMetadata.MINIMUM_ROLE, targets)
        if (minimum !== undefined && !isEpicUserRoleAtLeast(user.role, minimum)) {
            throw new ForbiddenException()
        }
        return true
    }

}
