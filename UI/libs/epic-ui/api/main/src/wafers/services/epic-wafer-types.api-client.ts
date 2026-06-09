import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { map, Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicWaferType, EpicWaferTypeCreate, EpicWaferTypeMap, EpicWaferTypeUpdate } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicWaferTypesApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/wafer-types`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicWaferType[]> {

        return this.httpClient.get<EpicWaferType[]>(this.baseUrl)
            .pipe(
                map((response) => response),
            )
    }

    fetchOne(id: number): Observable<EpicWaferType> {
        const url = `${this.baseUrl}/${id}`
        return this.httpClient.get<EpicWaferType>(url)
            .pipe(
                map((response) => response),
            )
    }

    fetchWaferTypeMap(waferTypeId: number): Observable<EpicWaferTypeMap> {
        const url = `${this.baseUrl}/${waferTypeId}/wafer-map`
        return this.httpClient.get<EpicWaferTypeMap>(url)
    }

    create(payload: EpicWaferTypeCreate): Observable<EpicWaferType> {
        return this.httpClient.post<EpicWaferType>(this.baseUrl, { ...payload })
            .pipe(
                map((response) => response),
            )
    }

    update(id: number, payload: Partial<EpicWaferTypeUpdate>): Observable<EpicWaferType> {
        const url = `${this.baseUrl}/${id}`
        return this.httpClient.patch<EpicWaferType>(url, { ...payload })
            .pipe(
                map((response) => response),
            )
    }

    deleteOne(id: number): Observable<EpicWaferType> {
        const url = `${this.baseUrl}/${id}`
        return this.httpClient.delete<EpicWaferType>(url)
            .pipe(
                map((response) => response),
            )
    }

}
