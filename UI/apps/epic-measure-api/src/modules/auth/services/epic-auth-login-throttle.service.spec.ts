// @vitest-environment node
import { EpicAuthLoginThrottleService } from './epic-auth-login-throttle.service'


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

    const fail = (login: string, times: number) => {
        for (let index = 0; index < times; index++) {
            throttle.recordFailure(login)
        }
    }

    it('locks a login for 60 s after the fifth failure within 5 minutes', () => {
        fail('jane.doe', 4)
        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)

        throttle.recordFailure('jane.doe')
        expect(throttle.lockRemainingMs('jane.doe')).toBe(60_000)

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

        throttle.recordFailure('jane.doe')

        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
    })

    it('counts a login in any case and with spaces as one login, and keeps logins apart', () => {
        fail('Jane.Doe', 2)
        fail(' jane.doe ', 2)
        fail('john', 4)
        throttle.recordFailure('JANE.DOE')

        expect(throttle.lockRemainingMs('jane.doe')).toBe(60_000)
        expect(throttle.lockRemainingMs('john')).toBe(0)
    })

    it('is cleared by a successful log-in', () => {
        fail('jane.doe', 4)
        throttle.clear('Jane.Doe')

        throttle.recordFailure('jane.doe')

        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
    })

    it('keeps at most MAX_LOGINS logins, and drops the oldest first', () => {
        fail('jane.doe', 5)
        for (let index = 0; index <= EpicAuthLoginThrottleService.MAX_LOGINS; index++) {
            throttle.recordFailure(`login-${index}`)
        }

        expect(throttle.lockRemainingMs('jane.doe')).toBe(0)
        expect((throttle as unknown as { logins: Map<string, unknown> }).logins.size).toBe(EpicAuthLoginThrottleService.MAX_LOGINS)
    })

})
