/**
 * Body of `POST /api/users/:id/password` (an Admin only): the new password of the user, set without its current
 * one. The BFF sends only its hash.
 */
export type EpicUserPasswordSetRequest = {
    /** `EPIC_USER_PASSWORD_MIN_LENGTH` to `EPIC_USER_PASSWORD_MAX_LENGTH` characters. */
    password: string
}
