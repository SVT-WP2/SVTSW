/**
 * The login rule of the users: 3 to 50 characters of `a-z`, `0-9`, `.`, `_` and `-`, after trimming and lower-casing.
 * The same rule as the check `SvtUser_login_check` of the table and the validation of the DB agent
 * (`DbAgentNext/docs/messages.md` §3.18): a login that breaks it cannot exist.
 */
export const EPIC_USER_LOGIN_PATTERN = /^[a-z0-9._-]{3,50}$/

/** The form in which a login is stored and compared: trimmed, in lower case. */
export function normalizeEpicUserLogin(login: string): string {
    return login.trim().toLowerCase()
}

/** True when `login` (already normalized) follows the login rule. */
export function isEpicUserLogin(login: string): boolean {
    return EPIC_USER_LOGIN_PATTERN.test(login)
}
