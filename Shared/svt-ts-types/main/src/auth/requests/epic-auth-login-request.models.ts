/** The body of `POST /api/auth/login`. The password is checked by the BFF; it never leaves the BFF. */
export type EpicAuthLoginRequest = {
    /** Trimmed and compared in lower case. */
    login: string
    password: string
}
