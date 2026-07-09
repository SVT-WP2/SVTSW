import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicSvtTest, EpicSvtTestCreate, EpicSvtTestsListQuery } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-tests`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(queryFilter: EpicSvtTestsListQuery.QueryFilter = {}): Observable<EpicSvtTest[]> {
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
        })
        return this.httpClient.get<EpicSvtTest[]>(this.baseUrl, { params })
    }

    fetchOne(entityId: number): Observable<EpicSvtTest> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTest>(url)
    }

    create(payload: EpicSvtTestCreate): Observable<EpicSvtTest> {
        return this.httpClient.post<EpicSvtTest>(this.baseUrl, { ...payload })
    }

}
