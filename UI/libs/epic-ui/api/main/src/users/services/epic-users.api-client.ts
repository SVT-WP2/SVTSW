import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { EpicUser, EpicUserCreateRequest, EpicUserPasswordSetRequest, EpicUserUpdateRequest } from 'svt-ts-types'

import { EpicApi } from '../../common'


/**
 * The user management of the BFF (`/api/users`), for an Admin only: another role gets `403`. A refusal of the DB agent
 * (a login that exists, the last active Admin) is `400` with its text in `error.message`.
 */
@Injectable({ providedIn: 'root' })
export class EpicUsersApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/users`

    // DI
    protected readonly httpClient = inject(HttpClient)

    /** Every user, active or not, in ascending order of id. */
    fetchList(): Observable<EpicUser[]> {
        return this.httpClient.get<EpicUser[]>(this.baseUrl)
    }

    create(request: EpicUserCreateRequest): Observable<EpicUser> {
        return this.httpClient.post<EpicUser>(this.baseUrl, request)
    }

    /** Changes the name, the role or the state (`isActive`) of a user. An absent key keeps the value. */
    update(id: number, request: EpicUserUpdateRequest): Observable<EpicUser> {
        return this.httpClient.patch<EpicUser>(`${this.baseUrl}/${id}`, request)
    }

    /** Sets a new password of a user, without its current one. */
    setPassword(id: number, request: EpicUserPasswordSetRequest): Observable<EpicUser> {
        return this.httpClient.post<EpicUser>(`${this.baseUrl}/${id}/password`, request)
    }

}
