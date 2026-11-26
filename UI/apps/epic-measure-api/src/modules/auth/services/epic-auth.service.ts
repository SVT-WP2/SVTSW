import { randomBytes } from 'node:crypto'

import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { hashEpicPassword, verifyEpicPassword } from 'epic/core'
import { firstValueFrom } from 'rxjs'
import { EpicAuthLoginRequest, EpicAuthUser } from 'svt-ts-types'

import { EpicAuthSvc, normalizeEpicLogin, toEpicAuthUser } from '../models'

import { EpicAuthLoginThrottleService } from './epic-auth-login-throttle.service'
import { EpicAuthSessionService } from './epic-auth-session.service'
import { EpicAuthUserCacheService } from './epic-auth-user-cache.service'
import { EpicAuthUsersService } from './epic-auth-users.service'


/** The `429` of a locked login; `retryAfterSeconds` goes into the `Retry-After` header. */
export class EpicAuthTooManyAttemptsException extends HttpException {

    constructor(readonly retryAfterSeconds: number) {
        super({
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: EpicAuthSvc.TOO_MANY_ATTEMPTS_MESSAGE,
            error: 'Too Many Requests',
        }, HttpStatus.TOO_MANY_REQUESTS)
    }

}

/**
 * The log-in (ticket 395): checks the password of a login against its hash, and makes the session token. The plain
 * password stays in this process: it is not logged, not sent and not returned.
 */
@Injectable()
export class EpicAuthService {

    /**
     * The hash that an unknown login is checked against, so that its answer takes as long as a wrong password. It is
     * the hash of a random value of this process, made at start.
     */
    private readonly dummyHash = hashEpicPassword(randomBytes(32).toString('base64'))

    constructor(
        private readonly users: EpicAuthUsersService,
        private readonly session: EpicAuthSessionService,
        private readonly userCache: EpicAuthUserCacheService,
        private readonly throttle: EpicAuthLoginThrottleService,
    ) {
    }

    /**
     * The user and a new session token. `401` with one text for an unknown login, a wrong password and a user that
     * is switched off; `429` while the login is locked, without asking the DB agent.
     */
    async login(request: EpicAuthLoginRequest): Promise<{ user: EpicAuthUser; token: string }> {
        const login = normalizeEpicLogin(request.login)
        return this.throttle.oneAtATime(login, () => this.attempt(login, request.password))
    }

    private async attempt(login: string, password: string): Promise<{ user: EpicAuthUser; token: string }> {
        const lockMs = this.throttle.lockRemainingMs(login)
        if (lockMs > 0) {
            throw new EpicAuthTooManyAttemptsException(Math.ceil(lockMs / 1000))
        }

        const credentials = await firstValueFrom(this.users.getCredentials(login))
        const isPassword = await verifyEpicPassword(password, credentials?.passwordHash ?? await this.dummyHash)
        if (!credentials || !isPassword || !credentials.isActive) {
            this.throttle.recordFailure(login)
            throw new UnauthorizedException(EpicAuthSvc.LOGIN_FAILED_MESSAGE)
        }

        this.throttle.clear(login)
        const { passwordHash, ...user } = credentials
        this.userCache.remember(user)
        return { user: toEpicAuthUser(user), token: this.session.sign(user.id) }
    }

}
