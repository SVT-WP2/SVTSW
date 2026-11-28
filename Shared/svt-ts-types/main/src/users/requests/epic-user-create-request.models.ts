import { EpicUserRole } from '../enums'


/**
 * Body of `POST /api/users` (an Admin only). The BFF trims the login and puts it in lower case, hashes the password
 * and sends only the hash to the DB agent. A new user is active.
 */
export type EpicUserCreateRequest = {
    /** The login rule: `EPIC_USER_LOGIN_PATTERN`, after trimming and lower-casing. */
    login: string
    name: string
    role: EpicUserRole
    /** `EPIC_USER_PASSWORD_MIN_LENGTH` to `EPIC_USER_PASSWORD_MAX_LENGTH` characters. */
    password: string
}
