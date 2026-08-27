import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { EMPTY, expand, map, Observable, toArray } from 'rxjs'

import { EpicApi, EpicApiPager, EpicApiPageResponse, getDefaultEpicApiPager } from '../../common'
import { EpicSvtTest, EpicSvtTestCreate, EpicSvtTestsListQuery } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-tests`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(
        queryFilter?: Partial<EpicSvtTestsListQuery.QueryFilter>,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicSvtTest>> {

        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
            ...({
                ...getDefaultEpicApiPager(),
                ...(pager || {}),
            }),
        })

        return this.httpClient.get<EpicApiPageResponse<EpicSvtTest>>(this.baseUrl, { params })
    }

    /**
     * Walks over every page of the paginated endpoint. Only for consumers that genuinely need the whole list
     * at once — a scrolling / paginated view must use `fetchList` with its own pager instead.
     */
    fetchAllList(queryFilter: Partial<EpicSvtTestsListQuery.QueryFilter> = {}, pageSize = 10 * 1000): Observable<EpicSvtTest[]> {
        const pager: EpicApiPager = {
            offset: 0,
            limit: pageSize,
        }
        let fetchedItemsCount = 0

        // fetch first page
        return this.fetchList(queryFilter, pager)
            .pipe(
                expand((response) => {
                    fetchedItemsCount += response.items.length
                    return fetchedItemsCount >= response.totalCount || !response.items.length
                        // do nothing if it is the last page
                        ? EMPTY
                        // fetch next page
                        : this.fetchList(queryFilter, { ...pager, offset: fetchedItemsCount })
                }),
                toArray(),
                map((responsesList) =>
                    responsesList
                        .reduce(
                            (acc, response) => [...acc, ...response.items],
                            [] as EpicSvtTest[],
                        ),
                ),
            )
    }

    fetchOne(entityId: number): Observable<EpicSvtTest> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTest>(url)
    }

    create(payload: EpicSvtTestCreate): Observable<EpicSvtTest> {
        return this.httpClient.post<EpicSvtTest>(this.baseUrl, { ...payload })
    }

}
