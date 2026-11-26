// @vitest-environment node
import { JwtService } from '@nestjs/jwt'
import type { Response } from 'express'

import { EpicAuthConfig, EpicAuthRequest } from '../models'

import { EpicAuthSessionService } from './epic-auth-session.service'


describe('EpicAuthSessionService', () => {

    const secret = 'a-secret-of-the-test-that-is-long-enough'
    const config = (cookieName = 'svt_session'): EpicAuthConfig => ({
        secret,
        sessionHours: 12,
        cookieSecure: false,
        userCacheMs: 0,
        cookieName,
    })

    function fakeResponse() {
        const cookie = vi.fn()
        const clearCookie = vi.fn()
        return { response: { cookie, clearCookie } as unknown as Response, cookie, clearCookie }
    }

    describe('the cookie name', () => {

        it.each(['svt_session', 'svt_session_dev'])('sets, clears and reads the cookie %s', (name) => {
            const session = new EpicAuthSessionService(config(name))
            const { response, cookie, clearCookie } = fakeResponse()

            session.setCookie(response, 'token')
            session.clearCookie(response)

            expect(cookie).toHaveBeenCalledWith(name, 'token', expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }))
            expect(clearCookie).toHaveBeenCalledWith(name, expect.objectContaining({ httpOnly: true, sameSite: 'strict', path: '/' }))
            expect(session.readToken({ cookies: { [name]: 'mine', other: 'not mine' } } as unknown as EpicAuthRequest)).toBe('mine')
            expect(session.readTokenFromCookieHeader(`other=1; ${name}=mine`)).toBe('mine')
        })

        it('does not read the cookie of another environment on the same host', () => {
            const dev = new EpicAuthSessionService(config('svt_session_dev'))

            expect(dev.readToken({ cookies: { svt_session: 'of-prod' } } as unknown as EpicAuthRequest)).toBeUndefined()
            expect(dev.readTokenFromCookieHeader('svt_session=of-prod')).toBeUndefined()
        })

    })

    describe('verify', () => {

        const session = new EpicAuthSessionService(config())

        it('answers the user id of a token that it made', () => {
            expect(session.verify(session.sign(42))).toBe(42)
        })

        it.each(['HS384', 'HS512'] as const)('refuses a %s token with the right secret: the algorithm is HS256 only', (algorithm) => {
            const token = new JwtService({ secret }).sign({ sub: '1' }, { algorithm })

            expect(session.verify(token)).toBeNull()
        })

        it.each([
            ['a leading zero', '01'],
            ['a space', ' 1'],
            ['an exponent', '1e1'],
            ['a sign', '-1'],
            ['zero', '0'],
            ['a number above the 32-bit range', '2147483648'],
            ['a number, not a string', 1],
        ])('refuses a subject with %s', (_, sub) => {
            const token = new JwtService({ secret }).sign({ sub }, { expiresIn: 60 })

            expect(session.verify(token)).toBeNull()
        })

    })

})
