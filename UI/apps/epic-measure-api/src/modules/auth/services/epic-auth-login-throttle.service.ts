import { Injectable } from '@nestjs/common'
import { normalizeEpicUserLogin } from 'svt-ts-types'

import { EpicAuthSvc } from '../models'


type LoginState = {
    /** When the failed log-ins of the window happened (ms). */
    failures: number[]
    /** Until when the login is locked (ms); 0 when it is not. */
    lockedUntil: number
    /** The attempts of the login that hold a slot now: started, not ended. */
    running: number
}

/**
 * A log-in attempt that holds a slot of its login. End it with `fail()` (wrong credentials) or `succeed()`, and
 * always `release()` it (`finally`): an attempt that ends otherwise (no reply, an error) gives its slot back and
 * counts nothing. Each method acts once; later calls do nothing.
 */
export type EpicAuthLoginAttempt = {
    fail(): void
    succeed(): void
    release(): void
}

/** `start` gives an attempt, or how long the caller should wait (`429`). */
export type EpicAuthLoginAdmission = { attempt: EpicAuthLoginAttempt } | { retryAfterMs: number }

/**
 * The limit of wrong log-ins, per login (trimmed, in lower case):
 *
 * - An attempt takes a slot before it does any work (`start`, synchronous). The failures of the last
 *   `WINDOW_MS` and the attempts that run now together may not reach `MAX_FAILURES`: beyond that, `429` at once,
 *   without a hash check and without a Kafka request. So no number of guesses sent at the same time gets past it.
 * - Every failed log-in counts, whatever the cause (unknown login, wrong password, user switched off), so the `429`
 *   does not tell them apart either. The failure that reaches `MAX_FAILURES` locks the login for `LOCK_MS`.
 * - A successful log-in clears the failures; attempts that still run stay counted.
 * - An attempt without an answer (timeout, error) gives its slot back and counts nothing.
 *
 * The state is in memory: a restart of the BFF clears it. Anybody who knows a login can keep it locked (a known
 * limit, `UI/docs/ARCHITECTURE.md` §10).
 */
@Injectable()
export class EpicAuthLoginThrottleService {

    static readonly MAX_FAILURES = 5
    static readonly WINDOW_MS = 5 * 60 * 1000
    static readonly LOCK_MS = 60 * 1000
    /**
     * The `Retry-After` of a `429` that comes from running attempts, not from a lock: by then they have ended (each
     * waits at most this long for the DB agent). If they all failed, the login is locked then.
     */
    static readonly BUSY_RETRY_AFTER_MS = EpicAuthSvc.DB_AGENT_TIMEOUT_MS
    /** Bounds the memory: logins are what a caller sends. Above it, the oldest logins are dropped. */
    static readonly MAX_LOGINS = 10_000

    private readonly logins = new Map<string, LoginState>()

    /** Takes a slot for an attempt of the login, or answers how long to wait. Synchronous: call it before any `await`. */
    start(login: string): EpicAuthLoginAdmission {
        const key = normalizeEpicUserLogin(login)
        const now = Date.now()
        const state = this.current(key, now)
        if (state.lockedUntil > now) {
            return { retryAfterMs: state.lockedUntil - now }
        }
        if (state.failures.length + state.running >= EpicAuthLoginThrottleService.MAX_FAILURES) {
            return { retryAfterMs: EpicAuthLoginThrottleService.BUSY_RETRY_AFTER_MS }
        }
        state.running++
        this.keep(key, state, now)

        let holdsSlot = true
        const giveBack = (): boolean => {
            if (!holdsSlot) {
                return false
            }
            holdsSlot = false
            state.running--
            return true
        }
        return {
            attempt: {
                fail: () => {
                    if (giveBack()) {
                        this.countFailure(state, Date.now())
                    }
                },
                succeed: () => {
                    if (giveBack()) {
                        state.failures = []
                        state.lockedUntil = 0
                    }
                },
                release: () => {
                    giveBack()
                    this.dropIfIdle(key, state, Date.now())
                },
            },
        }
    }

    /** How long the login stays locked, in ms; 0 when it is not locked. */
    lockRemainingMs(login: string): number {
        const state = this.logins.get(normalizeEpicUserLogin(login))
        const remaining = state ? state.lockedUntil - Date.now() : 0
        return remaining > 0 ? remaining : 0
    }

    clearAll(): void {
        this.logins.clear()
    }

    /** The state of the login, with the failures of the window only and an expired lock removed. */
    private current(key: string, now: number): LoginState {
        const state = this.logins.get(key) ?? { failures: [], lockedUntil: 0, running: 0 }
        state.failures = state.failures.filter((time) => time > now - EpicAuthLoginThrottleService.WINDOW_MS)
        if (state.lockedUntil <= now) {
            state.lockedUntil = 0
        }
        return state
    }

    private countFailure(state: LoginState, now: number): void {
        state.failures = state.failures.filter((time) => time > now - EpicAuthLoginThrottleService.WINDOW_MS)
        state.failures.push(now)
        if (state.failures.length >= EpicAuthLoginThrottleService.MAX_FAILURES) {
            state.failures = []
            state.lockedUntil = now + EpicAuthLoginThrottleService.LOCK_MS
        }
    }

    /** Stores the state as the newest login, then keeps the map within `MAX_LOGINS`. */
    private keep(key: string, state: LoginState, now: number): void {
        this.logins.delete(key)
        this.logins.set(key, state)
        if (this.logins.size <= EpicAuthLoginThrottleService.MAX_LOGINS) {
            return
        }
        for (const [oldKey, oldState] of this.logins) {
            if (this.isIdle(oldState, now)) {
                this.logins.delete(oldKey)
            }
        }
        // The map keeps the order of the last start: the first keys are the oldest. Logins with a running attempt go
        // last; an attempt whose login was dropped acts on its own state object, which is no longer in the map.
        for (const onlyIdle of [true, false]) {
            for (const [oldKey, oldState] of this.logins) {
                if (this.logins.size <= EpicAuthLoginThrottleService.MAX_LOGINS) {
                    return
                }
                if (oldKey !== key && (!onlyIdle || oldState.running === 0)) {
                    this.logins.delete(oldKey)
                }
            }
        }
    }

    private dropIfIdle(key: string, state: LoginState, now: number): void {
        if (this.logins.get(key) === state && this.isIdle(state, now)) {
            this.logins.delete(key)
        }
    }

    private isIdle(state: LoginState, now: number): boolean {
        return state.running === 0
            && state.lockedUntil <= now
            && !state.failures.some((time) => time > now - EpicAuthLoginThrottleService.WINDOW_MS)
    }

}
