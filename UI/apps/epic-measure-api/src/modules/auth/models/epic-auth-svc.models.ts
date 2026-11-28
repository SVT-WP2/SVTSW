export namespace EpicAuthSvc {

    /** The DI token of the module's Kafka client. */
    export const SERVICE_NAME = 'EPIC_AUTH_MICROSERVICE'

    /** The DI token of `EpicAuthConfig`. */
    export const CONFIG = 'EPIC_AUTH_CONFIG'

    /**
     * The name of the session cookie when `SVT_UI_AUTH_COOKIE_NAME` is not set. The cookie is `HttpOnly`: the code in
     * the browser cannot read it (ticket 392, D8).
     */
    export const DEFAULT_SESSION_COOKIE_NAME = 'svt_session'

    /**
     * The one answer of a log-in that fails: it does not tell an unknown login from a wrong password or a user that
     * is switched off.
     */
    export const LOGIN_FAILED_MESSAGE = 'Unknown combination login/password.'

    export const TOO_MANY_ATTEMPTS_MESSAGE = 'Too many attempts. Try again in a minute.'

    /** How long the log-in and the guard wait for the DB agent: then `503` with `DB_AGENT_TIMEOUT_MESSAGE`. */
    export const DB_AGENT_TIMEOUT_MS = 10_000

    export const DB_AGENT_TIMEOUT_MESSAGE = 'The user database does not answer. Try again later.'

    /** The close code of a WebSocket without a valid session (4000 to 4999 are free for applications). */
    export const WS_CLOSE_UNAUTHORIZED = 4401

}
