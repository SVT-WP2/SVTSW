import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicWaferTest, EpicWaferTestCreate, EpicWaferTestUpdate } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicWaferTestsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/wafer-tests`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicWaferTest[]> {
        return this.httpClient.get<EpicWaferTest[]>(this.baseUrl)
    }

    fetchOne(entityId: number): Observable<EpicWaferTest> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicWaferTest>(url)
    }

    update(entityId: number, update: EpicWaferTestUpdate): Observable<EpicWaferTest> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.patch<EpicWaferTest>(url, { ...update })
    }

    create(payload: EpicWaferTestCreate): Observable<EpicWaferTest> {
        return this.httpClient.post<EpicWaferTest>(this.baseUrl, { ...payload })
    }

    start(entityId: number): Observable<EpicWaferTest> {
        const url = `${this.baseUrl}/start`
        return this.httpClient.post<EpicWaferTest>(url, { entityId })
    }

    abort(entityId: number): Observable<EpicWaferTest> {
        const url = `${this.baseUrl}/abort`
        return this.httpClient.post<EpicWaferTest>(this.baseUrl, { entityId })
    }

}
