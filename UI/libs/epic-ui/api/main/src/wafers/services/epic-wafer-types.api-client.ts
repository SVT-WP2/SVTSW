import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { EpicWaferType, EpicWaferTypeCreateRequest, EpicWaferTypeMap } from 'epic-api-types'
import { map, Observable } from 'rxjs'

import { EpicApi } from '../../common'


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

    fetchWaferTypeMap(waferTypeId: number): Observable<EpicWaferTypeMap> {
        const url = `${this.baseUrl}/${waferTypeId}/wafer-map`
        return this.httpClient.get<EpicWaferTypeMap>(url)
    }

    create(payload: EpicWaferTypeCreateRequest): Observable<EpicWaferType> {
        return this.httpClient.post<EpicWaferType>(this.baseUrl, { ...payload })
            .pipe(
                map((response) => response),
            )
    }

}
