import { HttpErrorResponse, HttpInterceptorFn, HttpStatusCode } from '@angular/common/http'
import { inject } from '@angular/core'
import { Router } from '@angular/router'
import { EpicApi } from 'epic-ui/api'
import { catchError, throwError } from 'rxjs'

import { EpicAuthService } from '../services'


/** The two requests whose `401` is an answer, not an ended session: the log-in page and the guards handle them. */
const OWN_ANSWER_PATHS = [`${EpicApi.BASE_URL}/auth/login`, `${EpicApi.BASE_URL}/auth/me`]

/**
 * A `401` from the BFF means that the session has ended while the page was open (it expired, or the user was
 * switched off): forget the user and go to the log-in page. The error still reaches the caller.
 */
export const epicAuthInterceptor: HttpInterceptorFn = (request, next) => {
    const authService = inject(EpicAuthService)
    const router = inject(Router)

    return next(request)
        .pipe(
            catchError((error: unknown) => {
                if (error instanceof HttpErrorResponse && error.status === HttpStatusCode.Unauthorized && isSessionRequest(request.url)) {
                    authService.clearUser()
                    void router.navigate(['/auth/login'])
                }
                return throwError(() => error)
            }),
        )
}

/** A request to the BFF of this origin (`/api/...`), other than the log-in and `me`. */
function isSessionRequest(url: string): boolean {
    const target = new URL(url, window.location.href)
    return target.origin === window.location.origin
        && target.pathname.startsWith(`${EpicApi.BASE_URL}/`)
        && !OWN_ANSWER_PATHS.includes(target.pathname)
}
