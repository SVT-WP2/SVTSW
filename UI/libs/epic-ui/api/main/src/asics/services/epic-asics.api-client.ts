import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { EpicApiPager, EpicApiPageResponse, EpicAsic, EpicAsicCreateRequest, EpicAsicsListQuery } from 'epic-api-types'
import { QueryHelpers } from 'epic-ui/utils'
import { EMPTY, expand, map, Observable, toArray } from 'rxjs'

import { EpicApi, getDefaultEpicApiPager } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicAsicsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/asics`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAsicsList(queryFilter?: EpicAsicsListQuery, pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicAsic>> {
        const url = `${this.baseUrl}`
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
            ...({
                ...getDefaultEpicApiPager(),
                ...(pager || {}),
            }),
        })

        return this.httpClient.get<EpicApiPageResponse<EpicAsic>>(url, { params })
    }

    fetchAllAsicsList(queryFilter: EpicAsicsListQuery = {}, pageSize = 10 * 1000): Observable<EpicAsic[]> {
        const pager: EpicApiPager = {
            offset: 0,
            limit: pageSize,
        }
        let fetchedItemsCount = 0
        // fetch first page
        return this.fetchAsicsList(queryFilter, pager)
            .pipe(
                expand((response) => {
                    fetchedItemsCount += response.items.length
                    return fetchedItemsCount === response.totalCount
                        // do nothing if it is last page
                        ? EMPTY
                        // fetch next page
                        : this.fetchAsicsList(queryFilter, { ...pager, offset: fetchedItemsCount })
                }),
                toArray(),
                map((responsesList) =>
                    responsesList
                        .reduce(
                            (acc, response) => [...acc, ...response.items],
                            [] as EpicAsic[],
                        ),
                ),
            )
    }

    fetchOne(asicId: number): Observable<EpicAsic> {
        const url = `${this.baseUrl}/${asicId}`
        return this.httpClient.get<EpicAsic>(url)
            .pipe(
                map((response) => response),
            )
    }

    create(payload: EpicAsicCreateRequest): Observable<EpicAsic> {
        const url = this.baseUrl
        return this.httpClient.post<EpicAsic>(url, { ...payload })
            .pipe(
                map((response) => response),
            )
    }

}
