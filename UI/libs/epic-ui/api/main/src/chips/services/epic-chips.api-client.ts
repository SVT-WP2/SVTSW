import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { map, Observable } from 'rxjs'

import { EpicApi, EpicApiPager, EpicApiPageResponse, getDefaultEpicApiPager } from '../../common'
import { EpicChip, EpicChipCreate, EpicChipCreateMany, EpicChipLocation, EpicChipLocationUpdate, EpicChipsListQuery } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicChipsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/chips`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchChipsList(
        queryFilter?: Partial<EpicChipsListQuery.QueryFilter>,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicChip>> {

        const url = `${this.baseUrl}`
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
            ...({
                ...getDefaultEpicApiPager(),
                ...(pager || {}),
            }),
        })

        return this.httpClient.get<EpicApiPageResponse<EpicChip>>(url, { params })
    }

    fetchOne(chipId: number): Observable<EpicChip> {
        const url = `${this.baseUrl}/${chipId}`
        return this.httpClient.get<EpicChip>(url)
            .pipe(
                map((response) => response),
            )
    }

    create(payload: EpicChipCreate): Observable<EpicChip> {
        return this.httpClient.post<EpicChip>(this.baseUrl, { ...payload })
    }

    createMany(payload: EpicChipCreateMany): Observable<EpicChip[]> {
        const url = `${this.baseUrl}/create-many`
        return this.httpClient.post<EpicChip[]>(url, { ...payload })
    }

    updateChipLocation(chipId: number, update: EpicChipLocationUpdate): Observable<EpicChip> {
        const url = `${this.baseUrl}/${chipId}/location`
        return this.httpClient.post<EpicChip>(url, { ...update })
    }

    fetchChipLocationHistory(chipId: number): Observable<EpicChipLocation[]> {
        const url = `${this.baseUrl}/${chipId}/location-history`
        return this.httpClient.get<EpicChipLocation[]>(url)
    }

}
