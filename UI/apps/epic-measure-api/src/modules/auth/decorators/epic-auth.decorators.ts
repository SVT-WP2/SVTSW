import { createParamDecorator, CustomDecorator, ExecutionContext, SetMetadata } from '@nestjs/common'
import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'

import { EpicAuthRequest } from '../models'


export namespace EpicAuthMetadata {

    export const PUBLIC = 'epic:auth:public'
    export const MINIMUM_ROLE = 'epic:auth:minimum-role'

}

/**
 * A route (or every route of a controller) that `EpicAuthGuard` lets through without a session. Every other route
 * needs one: deny by default.
 */
export function EpicPublic(): CustomDecorator<string> {
    return SetMetadata(EpicAuthMetadata.PUBLIC, true)
}

/**
 * A route that needs `minimum` or a higher role (User < Expert < Developer < Admin), on top of a session: `403`
 * otherwise. The method's decorator wins over the controller's.
 */
export function EpicRoles(minimum: EpicUserRole): CustomDecorator<string> {
    return SetMetadata(EpicAuthMetadata.MINIMUM_ROLE, minimum)
}

/** The logged-in user of the request, as `EpicAuthGuard` put it there. */
export const EpicCurrentUser = createParamDecorator(
    (data: unknown, context: ExecutionContext): EpicAuthUser | undefined => context.switchToHttp().getRequest<EpicAuthRequest>().user,
)
