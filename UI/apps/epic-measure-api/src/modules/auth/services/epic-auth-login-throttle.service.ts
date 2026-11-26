import { Injectable } from '@nestjs/common'

import { normalizeEpicLogin } from '../models'


type LoginState = {
    /** When the failed log-ins of the window happened (ms). */
    failures: number[]
    /** Until when the login is locked (ms); 0 when it is not. */
    lockedUntil: number
}

/**
 * The limit of wrong log-ins: after `MAX_FAILURES` failed log-ins of one login within `WINDOW_MS`, that login is
 * locked for `LOCK_MS`, and the BFF answers `429` without asking the DB agent. Every failed log-in counts, whatever
 * the cause (unknown login, wrong password, user switched off), so the `429` does not tell them apart either. A
 * successful log-in clears the login. The state is in memory: a restart of the BFF clears it.
 */
@Injectable()
export class EpicAuthLoginThrottleService {

    static readonly MAX_FAILURES = 5
    static readonly WINDOW_MS = 5 * 60 * 1000
    static readonly LOCK_MS = 60 * 1000
    /** Bounds the memory: logins are what a caller sends. Above it, the oldest login is dropped. */
    static readonly MAX_LOGINS = 10_000

    private readonly logins = new Map<string, LoginState>()

    /** The last attempt of each login that is still running: the next one waits for it (`oneAtATime`). */
    private readonly running = new Map<string, Promise<unknown>>()

    /**
     * Runs the attempts of one login one after another. Without it, many attempts sent at the same time would all
     * pass the check of the limit before the first one is counted (each takes the time of a hash).
     */
    async oneAtATime<T>(login: string, attempt: () => Promise<T>): Promise<T> {
        const key = normalizeEpicLogin(login)
        const previous = this.running.get(key) ?? Promise.resolve()
        const result = previous.then(attempt, attempt)
        const done = result.then(() => undefined, () => undefined)
        this.running.set(key, done)
        try {
            return await result
        }
        finally {
            if (this.running.get(key) === done) {
                this.running.delete(key)
            }
        }
    }

    /** How long the login stays locked, in ms; 0 when it is not locked. */
    lockRemainingMs(login: string): number {
        const state = this.logins.get(normalizeEpicLogin(login))
        const remaining = state ? state.lockedUntil - Date.now() : 0
        return remaining > 0 ? remaining : 0
    }

    /** Counts one failed log-in. The one that reaches the limit locks the login. */
    recordFailure(login: string): void {
        const key = normalizeEpicLogin(login)
        const now = Date.now()
        const state = this.logins.get(key) ?? { failures: [], lockedUntil: 0 }
        state.failures = state.failures.filter((time) => time > now - EpicAuthLoginThrottleService.WINDOW_MS)
        state.failures.push(now)
        if (state.failures.length >= EpicAuthLoginThrottleService.MAX_FAILURES) {
            state.failures = []
            state.lockedUntil = now + EpicAuthLoginThrottleService.LOCK_MS
        }
        this.logins.delete(key)
        this.logins.set(key, state)
        this.prune(now)
    }

    /** A successful log-in: the login starts again from zero. */
    clear(login: string): void {
        this.logins.delete(normalizeEpicLogin(login))
    }

    clearAll(): void {
        this.logins.clear()
    }

    private prune(now: number): void {
        if (this.logins.size <= EpicAuthLoginThrottleService.MAX_LOGINS) {
            return
        }
        for (const [key, state] of this.logins) {
            const isRecent = state.failures.some((time) => time > now - EpicAuthLoginThrottleService.WINDOW_MS)
            if (!isRecent && state.lockedUntil <= now) {
                this.logins.delete(key)
            }
        }
        // The map keeps the order of the last change: the first keys are the oldest.
        for (const key of this.logins.keys()) {
            if (this.logins.size <= EpicAuthLoginThrottleService.MAX_LOGINS) {
                break
            }
            this.logins.delete(key)
        }
    }

}
