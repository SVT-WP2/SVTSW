import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { EpicAuthApiClient } from 'epic-ui/api'
import { isEqual } from 'lodash-es'
import { BehaviorSubject, catchError, distinctUntilChanged, map, Observable, of, shareReplay, tap, throwError } from 'rxjs'
import { EpicAuthUser } from 'svt-ts-types'


export type EpicAuthAuthorization = {
    isAuthorized: boolean
    user?: EpicAuthUser | null
}

/** The texts of a failed log-in that the log-in page shows. */
export namespace EpicAuthMessages {

    export const LOGIN_FAILED = 'Unknown combination login/password.'
    export const TOO_MANY_ATTEMPTS = 'Too many attempts. Try again in a minute.'
    export const LOGIN_UNAVAILABLE = 'The log-in failed. Try again later.'
    export const LOGOUT_FAILED = 'The log-out failed: the server did not answer. You are still logged in; try again.'

}

/**
 * The logged-in user of the SPA. The BFF checks the password and keeps the session in an `HttpOnly` cookie, which
 * this code cannot read: the user is known from the answer of the log-in, or of `GET /api/auth/me`, and kept in
 * memory only. No user, password or hash is in the browser code or in its storage.
 */
@Injectable({ providedIn: 'root' })
export class EpicAuthService {

    readonly user$: Observable<EpicAuthUser | null>
    readonly isLoggedIn$: Observable<boolean>

    private _user$ = new BehaviorSubject<EpicAuthUser | null>(null)

    /** The answer of `GET /api/auth/me`, asked once and remembered (`null`: not asked yet). */
    private authorization$: Observable<EpicAuthAuthorization> | null = null

    private readonly api = inject(EpicAuthApiClient)

    constructor() {
        this.user$ = this._user$.asObservable()
        this.isLoggedIn$ = this.user$
            .pipe(
                map(user => !!user),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )
    }

    get user(): EpicAuthUser | null {
        return this._user$.getValue()
    }

    get isLoggedIn(): boolean {
        return !!this._user$.getValue()
    }

    /** Logs in at the BFF. A failure is an `Error` whose message the log-in page shows. */
    login(login: string, password: string): Observable<EpicAuthUser> {
        return this.api.login({ login, password })
            .pipe(
                tap(user => {
                    this._user$.next(user)
                    this.authorization$ = null
                }),
                catchError((error: unknown) => throwError(() => new Error(toLoginErrorMessage(error)))),
            )
    }

    /**
     * Whether a user is logged in. Asks `GET /api/auth/me` once and remembers the answer; a `401` means "not logged
     * in". Another failure (no BFF) is not remembered: the next call asks again.
     */
    authorize(): Observable<EpicAuthAuthorization> {
        if (this.isLoggedIn) {
            return of({ isAuthorized: true, user: this.user })
        }
        if (!this.authorization$) {
            const authorization$ = this.api.me()
                .pipe(
                    map((user): EpicAuthAuthorization => {
                        this._user$.next(user)
                        return { isAuthorized: true, user }
                    }),
                    catchError((error: unknown) => {
                        if (!isUnauthorized(error) && this.authorization$ === authorization$) {
                            this.authorization$ = null
                        }
                        return of({ isAuthorized: false })
                    }),
                    shareReplay(1),
                )
            this.authorization$ = authorization$
        }
        return this.authorization$
    }

    /**
     * Ends the session at the BFF (the cookie is cleared), then forgets the user and reloads the page. A `401` means
     * that the session had ended already: the same. Any other failure keeps the user and the page (the cookie may
     * still be valid) and errors with `EpicAuthMessages.LOGOUT_FAILED`, for the page to show.
     */
    logout(): Observable<void> {
        return this.api.logout()
            .pipe(
                map(() => undefined),
                catchError((error: unknown) => isUnauthorized(error)
                    ? of(undefined)
                    : throwError(() => new Error(EpicAuthMessages.LOGOUT_FAILED))),
                tap(() => {
                    this.clearUser()
                    this.reloadPage()
                }),
            )
    }

    /** Forgets the user without asking the BFF: the session has ended there (a `401`, see `epicAuthInterceptor`). */
    clearUser(): void {
        this.authorization$ = of({ isAuthorized: false })
        this._user$.next(null)
    }

    protected reloadPage(): void {
        window.location.reload()
    }

}

function isUnauthorized(error: unknown): boolean {
    return error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized
}

function toLoginErrorMessage(error: unknown): string {
    if (isUnauthorized(error)) {
        const message = ((error as HttpErrorResponse).error as { message?: unknown } | null)?.message
        return typeof message === 'string' && message ? message : EpicAuthMessages.LOGIN_FAILED
    }
    if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.TooManyRequests) {
        return EpicAuthMessages.TOO_MANY_ATTEMPTS
    }
    return EpicAuthMessages.LOGIN_UNAVAILABLE
}
