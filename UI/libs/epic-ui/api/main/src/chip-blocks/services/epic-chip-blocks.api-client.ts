import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicApi, EpicApiPager, EpicApiPageResponse, getDefaultEpicApiPager } from '../../common'
import { EpicChipBlock, EpicChipBlocksListQuery } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicChipBlocksApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/chip-blocks`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(
        queryFilter?: Partial<EpicChipBlocksListQuery.QueryFilter>,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicChipBlock>> {

        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
            ...({
                ...getDefaultEpicApiPager(),
                ...(pager || {}),
            }),
        })

        return this.httpClient.get<EpicApiPageResponse<EpicChipBlock>>(this.baseUrl, { params })
    }

    fetchOne(entityId: number): Observable<EpicChipBlock> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicChipBlock>(url)
    }

}
