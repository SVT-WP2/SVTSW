import { Inject, Injectable } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import type { CookieOptions, Response } from 'express'

import { EpicAuthConfig, EpicAuthRequest, EpicAuthSvc } from '../models'


/** The decimal form of a user id in the token, as in the header `svt_userId`: no sign, no leading zero. */
const USER_ID = /^[1-9][0-9]{0,9}$/

/**
 * The session of the UI (ticket 392, D8): a JWT signed with HS256, payload `{ sub: "<user id>" }`, in the cookie
 * `svt_session`. The BFF keeps no session store: a token is valid until it expires, also after a log-out.
 */
@Injectable()
export class EpicAuthSessionService {

    private readonly jwt: JwtService

    constructor(
        @Inject(EpicAuthSvc.CONFIG) private readonly config: EpicAuthConfig,
    ) {
        this.jwt = new JwtService({
            secret: config.secret,
            signOptions: { algorithm: 'HS256', expiresIn: Math.round(config.sessionHours * 3600) },
            verifyOptions: { algorithms: ['HS256'] },
        })
    }

    /** A new session token for the user. */
    sign(userId: number): string {
        return this.jwt.sign({ sub: String(userId) })
    }

    /** The user id of a valid token; `null` for no token, a bad signature, an expired token or a wrong payload. */
    verify(token: unknown): number | null {
        if (typeof token !== 'string' || !token) {
            return null
        }
        try {
            const { sub } = this.jwt.verify<{ sub?: unknown }>(token)
            return typeof sub === 'string' && USER_ID.test(sub) && Number(sub) <= 2_147_483_647 ? Number(sub) : null
        }
        catch {
            return null
        }
    }

    /** The token of the session cookie of an HTTP request (parsed by `cookie-parser`). */
    readToken(request: EpicAuthRequest): unknown {
        return (request.cookies as Record<string, unknown> | undefined)?.[EpicAuthSvc.SESSION_COOKIE_NAME]
    }

    /** The token of the session cookie in a raw `Cookie` header (the upgrade request of a WebSocket). */
    readTokenFromCookieHeader(cookieHeader: string | undefined): string | undefined {
        for (const part of (cookieHeader ?? '').split(';')) {
            const index = part.indexOf('=')
            if (index > 0 && part.slice(0, index).trim() === EpicAuthSvc.SESSION_COOKIE_NAME) {
                return part.slice(index + 1).trim()
            }
        }
        return undefined
    }

    setCookie(response: Response, token: string): void {
        response.cookie(EpicAuthSvc.SESSION_COOKIE_NAME, token, {
            ...this.cookieOptions(),
            maxAge: Math.round(this.config.sessionHours * 3600 * 1000),
        })
    }

    clearCookie(response: Response): void {
        response.clearCookie(EpicAuthSvc.SESSION_COOKIE_NAME, this.cookieOptions())
    }

    private cookieOptions(): CookieOptions {
        return { httpOnly: true, sameSite: 'strict', path: '/', secure: this.config.cookieSecure }
    }

}
