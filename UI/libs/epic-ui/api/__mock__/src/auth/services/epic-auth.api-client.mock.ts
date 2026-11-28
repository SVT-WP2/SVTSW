import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { EpicAuthApiClient } from 'epic-ui/api'
import { defer, delay, Observable, of, throwError } from 'rxjs'
import { EpicAuthLoginRequest, EpicAuthPasswordChangeRequest, EpicAuthUser } from 'svt-ts-types'

import { EpicAuthMock } from '../models'


/**
 * The log-in of the mock mode, with no backend: the four users of `EpicAuthMock`, any password that is not empty.
 * It answers `401` as the BFF does, and keeps the login of its user in `localStorage` so that a reload keeps it.
 */
@Injectable({ providedIn: 'root' })
export class EpicAuthApiClientMock extends EpicAuthApiClient {

    override login(request: EpicAuthLoginRequest): Observable<EpicAuthUser> {
        return defer(() => {
            const user = this.findUser(request.login)
            if (!user || !request.password) {
                return throwError(() => unauthorized('Unknown combination login/password.'))
            }
            this.storeLogin(user.login)
            return of(user)
        })
            .pipe(
                delay(100),
            )
    }

    override logout(): Observable<void> {
        return defer(() => {
            this.storeLogin(null)
            return of(undefined)
        })
    }

    override me(): Observable<EpicAuthUser> {
        return defer(() => {
            const user = this.findUser(this.readLogin() ?? '')
            return user ? of(user) : throwError(() => unauthorized('Unauthorized'))
        })
            .pipe(
                delay(50),
            )
    }

    /**
     * As the mock log-in, any current password that is not empty is right; an empty one answers the `400` of the BFF.
     * Nothing is stored: the mock users log in with any password anyway.
     */
    override changeOwnPassword(request: EpicAuthPasswordChangeRequest): Observable<void> {
        return defer(() => {
            if (!this.findUser(this.readLogin() ?? '')) {
                return throwError(() => unauthorized('Unauthorized'))
            }
            if (!request.currentPassword) {
                return throwError(() => new HttpErrorResponse({
                    status: HttpStatusCode.BadRequest,
                    statusText: 'Bad Request',
                    error: { statusCode: HttpStatusCode.BadRequest, message: 'The current password is wrong.', error: 'Bad Request' },
                }))
            }
            return of(undefined)
        })
            .pipe(
                delay(300),
            )
    }

    protected findUser(login: string): EpicAuthUser | undefined {
        return EpicAuthMock.getUsers().find((user) => user.login === login.trim().toLowerCase())
    }

    protected readLogin(): string | null {
        try {
            return window.localStorage.getItem(EpicAuthMock.STORAGE_KEY)
        }
        catch {
            return null
        }
    }

    protected storeLogin(login: string | null): void {
        try {
            if (login === null) {
                window.localStorage.removeItem(EpicAuthMock.STORAGE_KEY)
            }
            else {
                window.localStorage.setItem(EpicAuthMock.STORAGE_KEY, login)
            }
        }
        catch {
            // No storage (a private window): the mock user lasts until the reload.
        }
    }

}

function unauthorized(message: string): HttpErrorResponse {
    return new HttpErrorResponse({
        status: HttpStatusCode.Unauthorized,
        statusText: 'Unauthorized',
        error: { statusCode: HttpStatusCode.Unauthorized, message },
    })
}
