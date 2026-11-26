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
        })
    })

    it('reads every setting', () => {
        const config = loadEpicAuthConfig(reader({
            SVT_UI_AUTH_SECRET: secret,
            SVT_UI_AUTH_SESSION_HOURS: '8',
            SVT_UI_AUTH_COOKIE_SECURE: 'true',
            SVT_UI_AUTH_USER_CACHE_SECONDS: '0',
        }), 'production')

        expect(config).toEqual({ secret, sessionHours: 8, cookieSecure: true, userCacheMs: 0 })
    })

    it('does not start without a secret, or with a short one, and names the variable', () => {
        expect(() => loadEpicAuthConfig(reader({}), 'production')).toThrow(/SVT_UI_AUTH_SECRET .*at least 32 characters.*not set/)
        expect(() => loadEpicAuthConfig(reader({ SVT_UI_AUTH_SECRET: 'x'.repeat(31) }), 'production'))
            .toThrow(/SVT_UI_AUTH_SECRET .*31 characters long/)
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
    ])('refuses %s=%s', (name, value, message) => {
        expect(() => loadEpicAuthConfig(reader({ SVT_UI_AUTH_SECRET: secret, [name]: value }), 'production')).toThrow(message)
    })

})
