import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import { EpicSvtTestType, EpicSvtTestTypeCreateRequest, EpicSvtTestTypeUpdateRequest } from 'svt-ts-types'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypesApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-test-types`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(): Observable<EpicSvtTestType[]> {
        return this.httpClient.get<EpicSvtTestType[]>(this.baseUrl)
    }

    fetchOne(entityId: number): Observable<EpicSvtTestType> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTestType>(url)
    }

    update(entityId: number, update: EpicSvtTestTypeUpdateRequest): Observable<EpicSvtTestType> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.patch<EpicSvtTestType>(url, { ...update })
    }

    create(payload: EpicSvtTestTypeCreateRequest): Observable<EpicSvtTestType> {
        return this.httpClient.post<EpicSvtTestType>(this.baseUrl, { ...payload })
    }

}
