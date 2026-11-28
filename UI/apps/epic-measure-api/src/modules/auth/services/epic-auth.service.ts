import { randomBytes } from 'node:crypto'

import { BadRequestException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common'
import { hashEpicPassword, verifyEpicPassword } from 'epic/core'
import { processKafkaReplyError } from 'epic/entities'
import { firstValueFrom } from 'rxjs'
import {
    EpicAuthLoginRequest,
    EpicAuthPasswordChangeRequest,
    EpicAuthUser,
    isEpicUserLogin,
    normalizeEpicUserLogin,
} from 'svt-ts-types'

import { EpicAuthSvc, toEpicAuthUser } from '../models'

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
     * is switched off. `429` while the login is locked, or while its failures and its running attempts reach the
     * limit: then without a hash check and without asking the DB agent. `503` when the DB agent does not answer
     * within `EpicAuthSvc.DB_AGENT_TIMEOUT_MS` (not counted as a failed log-in, and the count stays).
     */
    async login(request: EpicAuthLoginRequest): Promise<{ user: EpicAuthUser; token: string }> {
        const login = normalizeEpicUserLogin(request.login)
        // The slot is taken before the first await: attempts sent at the same time cannot pass the limit together.
        const admission = this.throttle.start(login)
        if ('retryAfterMs' in admission) {
            throw new EpicAuthTooManyAttemptsException(Math.ceil(admission.retryAfterMs / 1000))
        }
        const { attempt } = admission
        // A change of the user while this log-in runs (switched off, another role) wins over what it read.
        const readMark = this.userCache.mark()
        try {
            // A login that breaks the login rule cannot exist: an unknown login, without asking the DB agent.
            const credentials = isEpicUserLogin(login) ? await firstValueFrom(this.users.getCredentials(login)) : null
            const isPassword = await verifyEpicPassword(request.password, credentials?.passwordHash ?? await this.dummyHash)
            if (!credentials || !isPassword || !credentials.isActive) {
                attempt.fail()
                throw new UnauthorizedException(EpicAuthSvc.LOGIN_FAILED_MESSAGE)
            }

            attempt.succeed()
            const { passwordHash, ...user } = credentials
            this.userCache.remember(user, readMark)
            return { user: toEpicAuthUser(user), token: this.session.sign(user.id) }
        }
        finally {
            // Every other end (no reply, an error) gives the slot back and counts nothing.
            attempt.release()
        }
    }

    /**
     * The logged-in user changes the own password (ticket 396). The current password is checked like a log-in of the
     * user's login, under the same limit: a wrong one is `400` (`CURRENT_PASSWORD_WRONG_MESSAGE`) and a counted
     * failure, `429` while the login is locked or busy. Then only the hash of the new password is sent. The session
     * stays valid.
     */
    async changePassword(user: EpicAuthUser, request: EpicAuthPasswordChangeRequest): Promise<void> {
        // The slot is taken before the first await, as at the log-in.
        const admission = this.throttle.start(user.login)
        if ('retryAfterMs' in admission) {
            throw new EpicAuthTooManyAttemptsException(Math.ceil(admission.retryAfterMs / 1000))
        }
        const { attempt } = admission
        try {
            const credentials = await firstValueFrom(this.users.getCredentials(user.login))
            if (credentials?.id !== user.id || !credentials.isActive) {
                // The guard has just read this user as active: only a change in between ends here. Not a guess.
                throw new UnauthorizedException()
            }
            if (!await verifyEpicPassword(request.currentPassword, credentials.passwordHash)) {
                attempt.fail()
                throw new BadRequestException(EpicAuthSvc.CURRENT_PASSWORD_WRONG_MESSAGE)
            }
            attempt.succeed()

            const passwordHash = await hashEpicPassword(request.newPassword)
            try {
                await processKafkaReplyError(() => firstValueFrom(this.users.updatePasswordHash(user.id, passwordHash)))
            }
            finally {
                this.userCache.forget(user.id)
            }
        }
        finally {
            attempt.release()
        }
    }

}
