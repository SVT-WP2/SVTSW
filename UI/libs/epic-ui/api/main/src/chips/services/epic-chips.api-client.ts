import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { map, Observable } from 'rxjs'
import {
    EpicApiPager,
    EpicApiPageResponse,
    EpicChip,
    EpicChipCreateManyRequest,
    EpicChipCreateRequest,
    EpicChipLocationHistoryRecord,
    EpicChipLocationUpdateRequest,
    EpicChipsListQuery,
} from 'svt-ts-types'

import { EpicApi, getDefaultEpicApiPager } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicChipsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/chips`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchChipsList(
        queryFilter?: Partial<EpicChipsListQuery>,
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

    create(payload: EpicChipCreateRequest): Observable<EpicChip> {
        return this.httpClient.post<EpicChip>(this.baseUrl, { ...payload })
    }

    createMany(payload: EpicChipCreateManyRequest): Observable<EpicChip[]> {
        const url = `${this.baseUrl}/create-many`
        return this.httpClient.post<EpicChip[]>(url, { ...payload })
    }

    updateChipLocation(chipId: number, update: EpicChipLocationUpdateRequest): Observable<EpicChip> {
        const url = `${this.baseUrl}/${chipId}/location`
        return this.httpClient.post<EpicChip>(url, { ...update })
    }

    fetchChipLocationHistory(chipId: number): Observable<EpicChipLocationHistoryRecord[]> {
        const url = `${this.baseUrl}/${chipId}/location-history`
        return this.httpClient.get<EpicChipLocationHistoryRecord[]>(url)
    }

}
