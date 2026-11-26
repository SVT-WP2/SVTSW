// @vitest-environment node
import { loadEpicAuthConfig } from './epic-auth-config.models'


describe('loadEpicAuthConfig', () => {

    const secret = 'x'.repeat(32)

    const reader = (values: Record<string, string>) => (name: string) => values[name]

    it('reads the secret and gives the defaults', () => {
        expect(loadEpicAuthConfig(reader({ SVT_UI_AUTH_SECRET: secret }), 'development')).toEqual({
            secret,
            sessionHours: 12,
            cookieSecure: false,
            userCacheMs: 30_000,
            cookieName: 'svt_session',
        })
    })

    it('reads every setting', () => {
        const config = loadEpicAuthConfig(reader({
            SVT_UI_AUTH_SECRET: secret,
            SVT_UI_AUTH_SESSION_HOURS: '8',
            SVT_UI_AUTH_COOKIE_SECURE: 'true',
            SVT_UI_AUTH_USER_CACHE_SECONDS: '0',
            SVT_UI_AUTH_COOKIE_NAME: 'svt_session_dev',
        }), 'production')

        expect(config).toEqual({ secret, sessionHours: 8, cookieSecure: true, userCacheMs: 0, cookieName: 'svt_session_dev' })
    })

    it('does not start without a secret, or with a short one, and names the variable', () => {
        expect(() => loadEpicAuthConfig(reader({}), 'production')).toThrow(/SVT_UI_AUTH_SECRET .*at least 32 characters.*no value/)
        expect(() => loadEpicAuthConfig(reader({ SVT_UI_AUTH_SECRET: 'x'.repeat(31) }), 'production'))
            .toThrow(/SVT_UI_AUTH_SECRET .*it has 31 characters/)
    })

    it('does not count the spaces around the secret: 32 spaces, or 31 characters in spaces, are refused', () => {
        expect(() => loadEpicAuthConfig(reader({ SVT_UI_AUTH_SECRET: ' '.repeat(32) }), 'production'))
            .toThrow(/SVT_UI_AUTH_SECRET .*at least 32 characters.*0 characters/)
        expect(() => loadEpicAuthConfig(reader({ SVT_UI_AUTH_SECRET: ` ${'x'.repeat(31)} ` }), 'production'))
            .toThrow(/SVT_UI_AUTH_SECRET .*31 characters/)
    })

    it('refuses the committed development value in production only', () => {
        const values = { SVT_UI_AUTH_SECRET: 'DEVELOPMENT-ONLY-not-a-secret-every-clone-has-it' }

        expect(() => loadEpicAuthConfig(reader(values), 'production')).toThrow(/SVT_UI_AUTH_SECRET holds a development value/)
        expect(loadEpicAuthConfig(reader(values), 'development').secret).toBe(values.SVT_UI_AUTH_SECRET)
        expect(loadEpicAuthConfig(reader(values), 'test').secret).toBe(values.SVT_UI_AUTH_SECRET)
    })

    it.each([
        ['SVT_UI_AUTH_SESSION_HOURS', '0', /SVT_UI_AUTH_SESSION_HOURS must be a number above 0/],
        ['SVT_UI_AUTH_SESSION_HOURS', 'twelve', /SVT_UI_AUTH_SESSION_HOURS must be a number above 0/],
        ['SVT_UI_AUTH_COOKIE_SECURE', 'yes', /SVT_UI_AUTH_COOKIE_SECURE must be true or false/],
        ['SVT_UI_AUTH_USER_CACHE_SECONDS', '-1', /SVT_UI_AUTH_USER_CACHE_SECONDS must be a number of at least 0/],
        ['SVT_UI_AUTH_COOKIE_NAME', 'svt session', /SVT_UI_AUTH_COOKIE_NAME may hold letters, digits, _ and - only/],
        ['SVT_UI_AUTH_COOKIE_NAME', 'svt;session', /SVT_UI_AUTH_COOKIE_NAME may hold letters, digits, _ and - only/],
        ['SVT_UI_AUTH_COOKIE_NAME', 'x'.repeat(65), /SVT_UI_AUTH_COOKIE_NAME may hold letters, digits, _ and - only/],
    ])('refuses %s=%s', (name, value, message) => {
        expect(() => loadEpicAuthConfig(reader({ SVT_UI_AUTH_SECRET: secret, [name]: value }), 'production')).toThrow(message)
    })

})
