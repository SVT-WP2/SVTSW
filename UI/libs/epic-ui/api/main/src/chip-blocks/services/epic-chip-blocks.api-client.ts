import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'
import { EpicApiPager, EpicApiPageResponse, EpicChipBlock, EpicChipBlocksListQuery } from 'svt-ts-types'

import { EpicApi, getDefaultEpicApiPager } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicChipBlocksApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/chip-blocks`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(
        queryFilter?: Partial<EpicChipBlocksListQuery>,
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
