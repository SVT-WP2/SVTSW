import { EpicUser } from 'svt-ts-types'


export namespace EpicUsersSvc {

    /** The DI token of the module's Kafka client. */
    export const SERVICE_NAME = 'EPIC_USERS_MICROSERVICE'

}

/**
 * The user as the user management routes answer it: exactly the keys of `EpicUser`. The answer is built by hand
 * because `ClassSerializerInterceptor` does not drop unknown keys: a key that a reply might carry (a hash) cannot
 * reach the browser.
 */
export function toEpicUser(user: EpicUser): EpicUser {
    return {
        id: user.id,
        login: user.login,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        createdAt: user.createdAt,
    }
}
