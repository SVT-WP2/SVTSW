// @vitest-environment node
import { EpicAuthLoginAttempt, EpicAuthLoginThrottleService } from './epic-auth-login-throttle.service'


describe('EpicAuthLoginThrottleService', () => {

    let throttle: EpicAuthLoginThrottleService

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-11-26T12:00:00Z'))
        throttle = new EpicAuthLoginThrottleService()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    /** A slot, or the test fails. */
    function start(login: string): EpicAuthLoginAttempt {
        const admission = throttle.start(login)
        if (!('attempt' in admission)) {
            throw new Error(`no slot for ${login}: ${JSON.stringify(admission)}`)
        }
        return admission.attempt
    }

    /** `times` failed log-ins, one after another. */
    function fail(login: string, times: number): void {
        for (let index = 0; index < times; index++) {
            const attempt = start(login)
            attempt.fail()
            attempt.release()
        }
    }

    const retryAfterMs = (login: string) => {
        const admission = throttle.start(login)
        return 'retryAfterMs' in admission ? admission.retryAfterMs : 0
    }

    describe('the lock', () => {

        it('locks a login for 60 s after the fifth failure within 5 minutes', () => {
            fail('jane.doe', 4)
            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)

            fail('jane.doe', 1)
            expect(throttle.lockRemainingMs('jane.doe')).toBe(60_000)
            expect(retryAfterMs('jane.doe')).toBe(60_000)

            vi.advanceTimersByTime(59_999)
            expect(throttle.lockRemainingMs('jane.doe')).toBe(1)
            vi.advanceTimersByTime(1)
            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        })

        it('starts from zero after the lock', () => {
            fail('jane.doe', 5)
            vi.advanceTimersByTime(60_000)

            fail('jane.doe', 4)

            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        })

        it('counts only the failures of the last 5 minutes', () => {
            fail('jane.doe', 4)
            vi.advanceTimersByTime(5 * 60_000)

            fail('jane.doe', 1)

            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        })

        it('counts a login in any case and with spaces as one login, and keeps logins apart', () => {
            fail('Jane.Doe', 2)
            fail(' jane.doe ', 2)
            fail('john', 4)
            fail('JANE.DOE', 1)

            expect(throttle.lockRemainingMs('jane.doe')).toBe(60_000)
            expect(throttle.lockRemainingMs('john')).toBe(0)
        })

        it('is cleared by a successful log-in', () => {
            fail('jane.doe', 4)
            const success = start('Jane.Doe')
            success.succeed()
            success.release()

            fail('jane.doe', 4)

            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        })

    })

    describe('the slots of running attempts', () => {

        it('lets the failures and the running attempts together reach five at most: the rest get 429 at once', () => {
            fail('jane.doe', 2)
            const running = [start('jane.doe'), start('jane.doe'), start('jane.doe')]

            const refused = throttle.start('JANE.DOE')

            expect(refused).toEqual({ retryAfterMs: EpicAuthLoginThrottleService.BUSY_RETRY_AFTER_MS })
            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
            running.forEach((attempt) => attempt.release())
        })

        it('gives every slot of 30 attempts started together to the first five only', () => {
            const admissions = Array.from({ length: 30 }, () => throttle.start('jane.doe'))

            expect(admissions.filter((admission) => 'attempt' in admission)).toHaveLength(5)
            expect(admissions.slice(5).every((admission) => 'retryAfterMs' in admission)).toBe(true)
        })

        it('turns a running attempt that fails into a counted failure, and the fifth locks', () => {
            const running = Array.from({ length: 5 }, () => start('jane.doe'))

            running.forEach((attempt) => {
                attempt.fail()
                attempt.release()
            })

            expect(throttle.lockRemainingMs('jane.doe')).toBe(60_000)
        })

        it('gives the slot of an attempt without an answer back, and counts nothing', () => {
            fail('jane.doe', 4)
            const lost = start('jane.doe')
            expect('retryAfterMs' in throttle.start('jane.doe')).toBe(true)

            lost.release()

            expect('attempt' in throttle.start('jane.doe')).toBe(true)
            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        })

        it('acts once per attempt: a second end or a second release changes nothing', () => {
            const attempt = start('jane.doe')
            attempt.fail()
            attempt.fail()
            attempt.release()
            attempt.release()

            fail('jane.doe', 3)
            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
            fail('jane.doe', 1)
            expect(throttle.lockRemainingMs('jane.doe')).toBe(60_000)
        })

        it('clears the failures at a success while other attempts of the login still run, and keeps those counted', () => {
            fail('jane.doe', 3)
            const success = start('jane.doe')
            const stillRunning = start('jane.doe')

            success.succeed()
            success.release()

            // No failures now, one attempt running: four more slots, then 429.
            const more = Array.from({ length: 4 }, () => start('jane.doe'))
            expect('retryAfterMs' in throttle.start('jane.doe')).toBe(true)
            stillRunning.release()
            more.forEach((attempt) => attempt.release())
            expect('attempt' in throttle.start('jane.doe')).toBe(true)
        })

    })

    describe('the memory bound', () => {

        it('keeps at most MAX_LOGINS logins, and drops the oldest first', () => {
            fail('jane.doe', 5)
            for (let index = 0; index <= EpicAuthLoginThrottleService.MAX_LOGINS; index++) {
                fail(`login-${index}`, 1)
            }

            expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
            expect((throttle as unknown as { logins: Map<string, unknown> }).logins.size).toBe(EpicAuthLoginThrottleService.MAX_LOGINS)
        })

        it('drops a login with a running attempt last, and that attempt still ends without an error or a negative count', () => {
            const running = start('jane.doe')
            for (let index = 0; index <= EpicAuthLoginThrottleService.MAX_LOGINS; index++) {
                start(`login-${index}`)
            }
            const logins = (throttle as unknown as { logins: Map<string, { running: number }> }).logins
            expect(logins.size).toBe(EpicAuthLoginThrottleService.MAX_LOGINS)
            expect(logins.has('jane.doe')).toBe(false)

            expect(() => {
                running.fail()
                running.release()
            }).not.toThrow()
            const again = start('jane.doe')
            expect(logins.get('jane.doe')?.running).toBe(1)
            again.release()
        })

        it('lets an attempt end after clearAll without an error', () => {
            const running = start('jane.doe')
            throttle.clearAll()

            expect(() => {
                running.succeed()
                running.release()
            }).not.toThrow()
            expect('attempt' in throttle.start('jane.doe')).toBe(true)
        })

    })

})
