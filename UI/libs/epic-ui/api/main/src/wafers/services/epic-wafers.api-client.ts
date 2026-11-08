import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'
import {
    EpicWafer,
    EpicWaferCreateRequest,
    EpicWaferLocationHistoryRecord,
    EpicWaferLocationUpdateRequest,
    EpicWaferUpdateRequest,
} from 'svt-ts-types'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicWafersApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/wafers`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicWafer[]> {
        return this.httpClient.get<EpicWafer[]>(this.baseUrl)
    }

    fetchOne(waferId: number): Observable<EpicWafer> {
        const url = `${this.baseUrl}/${waferId}`
        return this.httpClient.get<EpicWafer>(url)
    }

    update(id: number, update: EpicWaferUpdateRequest): Observable<EpicWafer> {
        const url = `${this.baseUrl}/${id}`
        return this.httpClient.patch<EpicWafer>(url, { ...update })
    }

    updateWaferLocation(id: number, update: EpicWaferLocationUpdateRequest): Observable<EpicWafer> {
        const url = `${this.baseUrl}/${id}/location`
        return this.httpClient.post<EpicWafer>(url, { ...update })
    }

    fetchWaferLocationHistory(waferId: number): Observable<EpicWaferLocationHistoryRecord[]> {
        const url = `${this.baseUrl}/${waferId}/location-history`
        return this.httpClient.get<EpicWaferLocationHistoryRecord[]>(url)
    }

    create(payload: EpicWaferCreateRequest): Observable<EpicWafer> {
        return this.httpClient.post<EpicWafer>(this.baseUrl, { ...payload })
    }

}
