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

}
