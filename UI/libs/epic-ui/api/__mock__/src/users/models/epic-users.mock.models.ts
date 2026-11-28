import { EpicUser } from 'svt-ts-types'

import { EpicAuthMock } from '../../auth'


/** The users of the mock mode: the four mock users of the log-in (`EpicAuthMock`), active. */
export namespace EpicUsersMock {

    /** The texts of the BFF (from the DB agent) that the mock answers with. */
    export namespace Messages {

        export const DUPLICATE_LOGIN = 'Failed entry creation: an entry with the same unique value already exists'
        export const LAST_ADMIN = 'The installation must keep one active Admin'

    }

    export function getUsers(): EpicUser[] {
        return EpicAuthMock.getUsers().map((user) => ({
            ...user,
            isActive: true,
            createdAt: new Date(Date.UTC(2026, 10, user.id, 8)).toISOString(),
        }))
    }

}
