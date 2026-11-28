// @vitest-environment node
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { verifyEpicPassword } from 'epic/core'
import { from, map, NEVER, of } from 'rxjs'
import { EpicUserRole } from 'svt-ts-types'
import { EpicKafkaReplyStatus, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { EpicAuthConfig, EpicAuthSvc } from '../models'

import { EpicAuthLoginThrottleService } from './epic-auth-login-throttle.service'
import { EpicAuthSessionService } from './epic-auth-session.service'
import { EpicAuthUserCacheService } from './epic-auth-user-cache.service'
import { EpicAuthUsersService } from './epic-auth-users.service'
import { EpicAuthService } from './epic-auth.service'


/** The hash of the dummy check, as the mocked `hashEpicPassword` makes it at the start of the service. */
const DUMMY_HASH = 'dummy-hash-of-this-process'

vi.mock('epic/core', () => ({
    hashEpicPassword: vi.fn(() => Promise.resolve(DUMMY_HASH)),
    verifyEpicPassword: vi.fn(() => Promise.resolve(false)),
}))

const JANE = {
    id: 7,
    login: 'jane.doe',
    name: 'Jane Doe',
    role: EpicUserRole.Expert,
    isActive: true,
    createdAt: '2026-11-26T12:00:00.000Z',
    passwordHash: 'stored-hash-of-jane',
}

const credentialsReply = () => of(new SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage({ entity: JANE }))

const notFoundReply = () => of(new SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage(
    undefined, EpicKafkaReplyStatus.NotFound, { message: 'No user with this login' }))

describe('EpicAuthService', () => {

    const config: EpicAuthConfig = {
        secret: 'x'.repeat(32),
        sessionHours: 12,
        cookieSecure: false,
        userCacheMs: 30_000,
        cookieName: 'svt_session',
    }
    const verify = vi.mocked(verifyEpicPassword)

    let send: ReturnType<typeof vi.fn>
    let throttle: EpicAuthLoginThrottleService
    let auth: EpicAuthService

    beforeEach(() => {
        verify.mockReset().mockResolvedValue(false)
        send = vi.fn()
        const users = new EpicAuthUsersService({ send, subscribeToResponseOf: vi.fn() } as unknown as ClientKafka)
        throttle = new EpicAuthLoginThrottleService()
        auth = new EpicAuthService(users, new EpicAuthSessionService(config), new EpicAuthUserCacheService(config, users), throttle)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    /** Failed log-ins counted before the test, as earlier attempts would have. */
    function failBefore(login: string, times: number): void {
        for (let index = 0; index < times; index++) {
            const admission = throttle.start(login)
            if ('attempt' in admission) {
                admission.attempt.fail()
                admission.attempt.release()
            }
        }
    }

    /** The outcome of a log-in as status codes, without throwing. */
    function outcome(promise: Promise<unknown>): Promise<number> {
        return promise.then(() => 200, (error: { status?: number }) => error.status ?? 500)
    }

    it('checks the password of an unknown login against the dummy hash, and answers the one 401', async () => {
        send.mockReturnValue(notFoundReply())

        await expect(auth.login({ login: 'nobody', password: 'a-password' })).rejects.toThrow(UnauthorizedException)

        expect(verify).toHaveBeenCalledTimes(1)
        expect(verify).toHaveBeenCalledWith('a-password', DUMMY_HASH)
    })

    it('checks the password of a known login against its hash', async () => {
        send.mockReturnValue(credentialsReply())
        verify.mockResolvedValue(true)

        const { user, token } = await auth.login({ login: ' Jane.Doe ', password: 'a-password' })

        expect(verify).toHaveBeenCalledWith('a-password', JANE.passwordHash)
        expect(user).toEqual({ id: 7, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert })
        expect(token).toEqual(expect.any(String))
        expect(send).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
            value: JSON.stringify(new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: 'jane.doe' })),
        }))
    })

    it.each([
        ['a control character', 'a\u0000b'],
        ['too short', 'ab'],
        ['too long', 'x'.repeat(51)],
        ['a character outside the rule', 'jane doe'],
    ])('treats a login that breaks the login rule (%s) as unknown, without asking the DB agent', async (_, login) => {
        await expect(auth.login({ login, password: 'a-password' })).rejects.toMatchObject({
            status: 401,
            message: EpicAuthSvc.LOGIN_FAILED_MESSAGE,
        })

        expect(send).not.toHaveBeenCalled()
        expect(verify).toHaveBeenCalledWith('a-password', DUMMY_HASH)
    })

    it('counts a login that breaks the rule as a failed log-in', async () => {
        for (let attempt = 0; attempt < EpicAuthLoginThrottleService.MAX_FAILURES; attempt++) {
            await expect(auth.login({ login: 'a\u0000b', password: 'x' })).rejects.toThrow(UnauthorizedException)
        }

        expect(throttle.lockRemainingMs('a\u0000b')).toBeGreaterThan(0)
    })

    it('answers 503 when the DB agent does not reply; that is no failed log-in, the count stays, and the next log-in works', async () => {
        vi.useFakeTimers()
        failBefore('jane.doe', EpicAuthLoginThrottleService.MAX_FAILURES - 1)
        send.mockReturnValueOnce(NEVER)

        const lost = auth.login({ login: 'jane.doe', password: 'a-password' })
        lost.catch(() => undefined)
        await vi.advanceTimersByTimeAsync(EpicAuthSvc.DB_AGENT_TIMEOUT_MS)

        await expect(lost).rejects.toBeInstanceOf(ServiceUnavailableException)
        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)

        send.mockReturnValueOnce(credentialsReply())
        verify.mockResolvedValueOnce(true)
        await expect(auth.login({ login: 'JANE.DOE', password: 'a-password' })).resolves.toMatchObject({ user: { id: 7 } })
    })

    it('keeps the count of failed log-ins over a 503', async () => {
        vi.useFakeTimers()
        failBefore('jane.doe', EpicAuthLoginThrottleService.MAX_FAILURES - 1)
        send.mockReturnValueOnce(NEVER).mockReturnValueOnce(credentialsReply())

        const lost = auth.login({ login: 'jane.doe', password: 'a-password' })
        lost.catch(() => undefined)
        await vi.advanceTimersByTimeAsync(EpicAuthSvc.DB_AGENT_TIMEOUT_MS)
        await expect(lost).rejects.toMatchObject({ status: 503 })
        await expect(auth.login({ login: 'jane.doe', password: 'wrong' })).rejects.toThrow(UnauthorizedException)

        expect(throttle.lockRemainingMs('jane.doe')).toBeGreaterThan(0)
    })


    it('lets five of 30 guesses sent together reach the check; 429 at once for the 25 others, the right password last too', async () => {
        let replyNow!: () => void
        const lateReply = new Promise<void>((resolve) => {
            replyNow = resolve
        })
        const reply = () => new SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage({ entity: JANE })
        const lateCredentials = () => from(lateReply).pipe(map(reply))
        send.mockImplementation(lateCredentials)
        verify.mockImplementation((password: string) => Promise.resolve(password === 'the-right-one'))

        const guesses = Array.from({ length: 30 }, (_, index) => outcome(auth.login({
            login: 'jane.doe',
            password: index === 29 ? 'the-right-one' : `guess-${index}`,
        })))
        const settled: number[] = []
        guesses.forEach((guess) => void guess.then((status) => settled.push(status)))
        await new Promise((resolve) => setImmediate(resolve))

        // Before any reply: 25 answered 429, five wait for the DB agent.
        expect(settled).toEqual(Array.from({ length: 25 }, () => 429))
        expect(send).toHaveBeenCalledTimes(5)
        expect(verify).not.toHaveBeenCalled()

        replyNow()
        const statuses = await Promise.all(guesses)

        expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401])
        expect(statuses.slice(5)).toEqual(Array.from({ length: 25 }, () => 429))
        expect(verify).toHaveBeenCalledTimes(5)
        expect(verify).not.toHaveBeenCalledWith('the-right-one', expect.anything())
        expect(throttle.lockRemainingMs('jane.doe')).toBeGreaterThan(0)
    })

    it('gives the slots of attempts that time out back, counts nothing, and the next log-in works', async () => {
        vi.useFakeTimers()
        send.mockReturnValue(NEVER)

        const lost = Array.from({ length: 5 }, () => outcome(auth.login({ login: 'jane.doe', password: 'a-password' })))
        expect(await outcome(auth.login({ login: 'jane.doe', password: 'a-password' }))).toBe(429)
        await vi.advanceTimersByTimeAsync(EpicAuthSvc.DB_AGENT_TIMEOUT_MS)

        expect(await Promise.all(lost)).toEqual([503, 503, 503, 503, 503])
        send.mockReturnValue(credentialsReply())
        verify.mockResolvedValue(true)
        expect(await outcome(auth.login({ login: 'jane.doe', password: 'a-password' }))).toBe(200)
    })

    it('gives the slot of an attempt that throws back, and counts nothing', async () => {
        send.mockReturnValue(credentialsReply())
        verify.mockRejectedValue(new Error('the hash check broke'))

        for (let attempt = 0; attempt < EpicAuthLoginThrottleService.MAX_FAILURES + 1; attempt++) {
            await expect(auth.login({ login: 'jane.doe', password: 'a-password' })).rejects.toThrow('the hash check broke')
        }

        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        verify.mockResolvedValue(true)
        expect(await outcome(auth.login({ login: 'jane.doe', password: 'a-password' }))).toBe(200)
    })

    it('clears the failures at a success while other attempts of the login still run', async () => {
        failBefore('jane.doe', 3)
        let replyNow!: () => void
        const lateReply = new Promise<void>((resolve) => {
            replyNow = resolve
        })
        send.mockReturnValueOnce(from(lateReply).pipe(map(() => new SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage({ entity: JANE }))))
            .mockReturnValue(credentialsReply())
        verify.mockImplementation((password: string) => Promise.resolve(password === 'the-right-one'))

        const stillRunning = outcome(auth.login({ login: 'jane.doe', password: 'wrong' }))
        expect(await outcome(auth.login({ login: 'jane.doe', password: 'the-right-one' }))).toBe(200)

        // No failures now and one attempt running: three more failures and the running one do not lock yet.
        for (let attempt = 0; attempt < 3; attempt++) {
            expect(await outcome(auth.login({ login: 'jane.doe', password: 'wrong' }))).toBe(401)
        }
        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        replyNow()
        expect(await stillRunning).toBe(401)
        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        expect(await outcome(auth.login({ login: 'jane.doe', password: 'wrong' }))).toBe(401)
        expect(throttle.lockRemainingMs('jane.doe')).toBeGreaterThan(0)
    })

})
