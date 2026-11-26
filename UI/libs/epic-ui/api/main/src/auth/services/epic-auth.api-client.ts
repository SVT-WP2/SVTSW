import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { EpicAuthLoginRequest, EpicAuthUser } from 'svt-ts-types'

import { EpicApi } from '../../common'


/**
 * The log-in of the BFF (`/api/auth`). The session is an `HttpOnly` cookie that the browser sends by itself: this
 * code never sees it, and keeps no user or password.
 */
@Injectable({ providedIn: 'root' })
export class EpicAuthApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/auth`

    // DI
    protected readonly httpClient = inject(HttpClient)

    /** `401` for an unknown combination of login and password, `429` while the login is locked. */
    login(request: EpicAuthLoginRequest): Observable<EpicAuthUser> {
        return this.httpClient.post<EpicAuthUser>(`${this.baseUrl}/login`, request)
    }

    logout(): Observable<void> {
        return this.httpClient.post<void>(`${this.baseUrl}/logout`, null)
    }

    /** The user of the session; `401` without a valid session. */
    me(): Observable<EpicAuthUser> {
        return this.httpClient.get<EpicAuthUser>(`${this.baseUrl}/me`)
    }

}
