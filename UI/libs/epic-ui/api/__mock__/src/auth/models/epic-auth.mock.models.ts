import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'


/** The users of the mock mode, one per role. Any password that is not empty logs them in. */
export namespace EpicAuthMock {

    /** Where the mock remembers its logged-in user, so that a reload keeps it. Mock mode only. */
    export const STORAGE_KEY = 'epic.mockAuth.login'

    export function getUsers(): EpicAuthUser[] {
        return [
            { id: 1, login: 'admin', name: 'Mock Admin', role: EpicUserRole.Admin },
            { id: 2, login: 'developer', name: 'Mock Developer', role: EpicUserRole.Developer },
            { id: 3, login: 'expert', name: 'Mock Expert', role: EpicUserRole.Expert },
            { id: 4, login: 'user', name: 'Mock User', role: EpicUserRole.User },
        ]
    }

    /** The mock user who is logged in now (the login kept in `localStorage`), `null` when nobody is. */
    export function getCurrentUser(): EpicAuthUser | null {
        try {
            const login = window.localStorage.getItem(STORAGE_KEY)
            return getUsers().find((user) => user.login === login) ?? null
        }
        catch {
            return null
        }
    }

    /**
     * The user of a seeded row (a history row, a test): the mock users in turn, and every fifth row without a user,
     * as the rows from before the users of #392.
     */
    export function getUserOfRow(index: number): EpicAuthUser | null {
        const users = [...getUsers(), null]
        return users[index % users.length]
    }

    /** `userId` and `userName` of a history row that this user wrote, as the DB agent answers them. */
    export function toRowUser(user: EpicAuthUser | null): { userId: number | null; userName: string | null } {
        return { userId: user?.id ?? null, userName: user?.name ?? null }
    }

    /** `createdByUserId` and `createdByUserName` of a test that this user created. */
    export function toCreatedBy(user: EpicAuthUser | null): { createdByUserId: number | null; createdByUserName: string | null } {
        return { createdByUserId: user?.id ?? null, createdByUserName: user?.name ?? null }
    }

}
