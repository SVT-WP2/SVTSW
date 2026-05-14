import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicSvtTestType, EpicSvtTestTypeCreate, EpicSvtTestTypeUpdate } from '../models'


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

    update(entityId: number, update: EpicSvtTestTypeUpdate): Observable<EpicSvtTestType> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.patch<EpicSvtTestType>(url, { ...update })
    }

    create(payload: EpicSvtTestTypeCreate): Observable<EpicSvtTestType> {
        return this.httpClient.post<EpicSvtTestType>(this.baseUrl, { ...payload })
    }

}
