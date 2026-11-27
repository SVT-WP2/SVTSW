/**
 * Body of `POST /api/auth/password`: the logged-in user changes the own password. A wrong `currentPassword` is `400`
 * and counts as a failed log-in of the user's login (the limit of the log-in).
 */
export type EpicAuthPasswordChangeRequest = {
    currentPassword: string
    /** `EPIC_USER_PASSWORD_MIN_LENGTH` to `EPIC_USER_PASSWORD_MAX_LENGTH` characters. */
    newPassword: string
}
