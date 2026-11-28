import { AsyncLocalStorage } from 'node:async_hooks'

import { MonoTypeOperatorFunction, Observable } from 'rxjs'


/**
 * What the BFF knows about the HTTP request that it is working on, for code that has no access to the request
 * object (the Kafka services). One context per request: `epicRequestContextMiddleware` opens it, `EpicAuthGuard`
 * writes the user into it, and `toEpicDbAgentKafkaRecord` reads the user from it.
 */
export namespace EpicRequestContext {

    export type Store = {
        /** The id of the logged-in user; absent before the guard has checked the session, and on public routes. */
        userId?: number
    }

    const storage = new AsyncLocalStorage<Store>()

    /** Runs `callback` in a new, empty context. Code that `callback` starts, also later in a promise, sees it. */
    export function run<T>(callback: () => T): T {
        return storage.run({}, callback)
    }

    /** Runs `callback` outside every request context: work at boot (the Kafka clients connect there). */
    export function outside<T>(callback: () => T): T {
        return storage.exit(callback)
    }

    /** The context of the caller, to run later work in it (`deliverIn`); `undefined` outside a request. */
    export function capture(): Store | undefined {
        return storage.getStore()
    }

    /** Runs `callback` in `store`, the same context object as the request's; with no store, outside every context. */
    export function runIn<T>(store: Store | undefined, callback: () => T): T {
        return store ? storage.run(store, callback) : storage.exit(callback)
    }

    /**
     * Delivers every notification of the source in `store`. Code that reacts to the notification (a `switchMap` that
     * sends the next request) then runs in the context of the request that started the chain, not in the context of
     * whoever emitted (the consumer of a Kafka client runs in the context in which it was started).
     */
    export function deliverIn<T>(store: Store | undefined): MonoTypeOperatorFunction<T> {
        return (source) => new Observable<T>((subscriber) => source.subscribe({
            next: (value) => runIn(store, () => subscriber.next(value)),
            error: (error: unknown) => runIn(store, () => subscriber.error(error)),
            complete: () => runIn(store, () => subscriber.complete()),
        }))
    }

    /**
     * Writes the user of the current request. Throws outside a request context: a request without the context
     * would go to the DB agent without the user, so the guard must fail instead.
     */
    export function setUserId(userId: number): void {
        const store = storage.getStore()
        if (!store) {
            throw new Error('No request context: register epicRequestContextMiddleware (configureEpicMeasureApiApp)')
        }
        if (!Number.isSafeInteger(userId) || userId <= 0) {
            throw new Error(`A user id is a positive integer, not ${String(userId)}`)
        }
        store.userId = userId
    }

    /** The user of the current request, or `undefined` (no context, or no user yet). */
    export function getUserId(): number | undefined {
        return storage.getStore()?.userId
    }

}
