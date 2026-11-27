/**
 * The password rule of the users: a string of 8 to 128 characters, and no other rule. The BFF checks it when a
 * password is set (a new user, a new password, the own password); the forms of the SPA check it too.
 */
export const EPIC_USER_PASSWORD_MIN_LENGTH = 8

export const EPIC_USER_PASSWORD_MAX_LENGTH = 128
