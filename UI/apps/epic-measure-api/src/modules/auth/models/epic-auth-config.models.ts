/** The settings of the log-in and the session, read from the environment once, at boot. */
export type EpicAuthConfig = {
    /** `SVT_UI_AUTH_SECRET`: the HS256 key of the session tokens. */
    secret: string
    /** `SVT_UI_AUTH_SESSION_HOURS`: the lifetime of a session, of its token and of its cookie. */
    sessionHours: number
    /** `SVT_UI_AUTH_COOKIE_SECURE`: the `Secure` flag of the cookie (only with HTTPS). */
    cookieSecure: boolean
    /** `SVT_UI_AUTH_USER_CACHE_SECONDS`, in ms: how long the guard keeps a user that it has read. */
    userCacheMs: number
}

export namespace EpicAuthConfigEnv {

    export const SECRET = 'SVT_UI_AUTH_SECRET'
    export const SESSION_HOURS = 'SVT_UI_AUTH_SESSION_HOURS'
    export const COOKIE_SECURE = 'SVT_UI_AUTH_COOKIE_SECURE'
    export const USER_CACHE_SECONDS = 'SVT_UI_AUTH_USER_CACHE_SECONDS'

    export const SECRET_MIN_LENGTH = 32

    /** The committed values of `.env.development` and `.env.test` start with this. Production refuses them. */
    export const DEVELOPMENT_SECRET_PREFIX = 'DEVELOPMENT-ONLY-'

    export const DEFAULT_SESSION_HOURS = 12
    export const DEFAULT_USER_CACHE_SECONDS = 30

}

/**
 * Reads and checks the settings. Throws, with the name of the variable, when one is missing or wrong: the BFF does
 * not start without a valid secret.
 */
export function loadEpicAuthConfig(read: (name: string) => string | undefined, nodeEnv = process.env.NODE_ENV): EpicAuthConfig {
    const secret = read(EpicAuthConfigEnv.SECRET) ?? ''
    if (secret.length < EpicAuthConfigEnv.SECRET_MIN_LENGTH) {
        throw new Error(
            `${EpicAuthConfigEnv.SECRET} must be set to a random value of at least ${EpicAuthConfigEnv.SECRET_MIN_LENGTH} characters `
            + `(it is ${secret ? `${secret.length} characters long` : 'not set'}). On a server it comes from the .env of the `
            + 'environment: see Environment/README.md.',
        )
    }
    if (nodeEnv === 'production' && secret.startsWith(EpicAuthConfigEnv.DEVELOPMENT_SECRET_PREFIX)) {
        throw new Error(
            `${EpicAuthConfigEnv.SECRET} holds a development value, which is in git. Set a random value of your own: `
            + 'see Environment/README.md.',
        )
    }

    const Env = EpicAuthConfigEnv
    return {
        secret,
        sessionHours: readNumber(read, Env.SESSION_HOURS, Env.DEFAULT_SESSION_HOURS, { min: 0, exclusiveMin: true }),
        cookieSecure: readBoolean(read, Env.COOKIE_SECURE, false),
        userCacheMs: readNumber(read, Env.USER_CACHE_SECONDS, Env.DEFAULT_USER_CACHE_SECONDS, { min: 0 }) * 1000,
    }
}

function readNumber(
    read: (name: string) => string | undefined,
    name: string,
    defaultValue: number,
    { min, exclusiveMin = false }: { min: number; exclusiveMin?: boolean },
): number {
    const text = read(name)?.trim()
    if (!text) {
        return defaultValue
    }
    const value = Number(text)
    if (!Number.isFinite(value) || value < min || (exclusiveMin && value === min)) {
        throw new Error(`${name} must be a number ${exclusiveMin ? 'above' : 'of at least'} ${min}, not "${text}"`)
    }
    return value
}

function readBoolean(read: (name: string) => string | undefined, name: string, defaultValue: boolean): boolean {
    const text = read(name)?.trim()
    if (!text) {
        return defaultValue
    }
    if (text !== 'true' && text !== 'false') {
        throw new Error(`${name} must be true or false, not "${text}"`)
    }
    return text === 'true'
}
