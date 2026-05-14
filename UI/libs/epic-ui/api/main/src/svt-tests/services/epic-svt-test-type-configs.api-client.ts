import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicSvtTestTypeConfig, EpicSvtTestTypeConfigBody, EpicSvtTestTypeConfigCreate } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypeConfigsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-test-type-configs`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(queryFilter: { ids?: number[]; testTypeId?: number } = {}): Observable<EpicSvtTestTypeConfig[]> {
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
        })
        return this.httpClient.get<EpicSvtTestTypeConfig[]>(this.baseUrl, { params })
    }

    fetchOne(entityId: number): Observable<EpicSvtTestTypeConfig> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTestTypeConfig>(url)
    }

    fetchConfigBody(entityId: number): Observable<EpicSvtTestTypeConfigBody> {
        const url = `${this.baseUrl}/${entityId}/config-body`
        return this.httpClient.get<EpicSvtTestTypeConfigBody>(url)
    }

    create(payload: EpicSvtTestTypeConfigCreate): Observable<EpicSvtTestTypeConfig> {
        return this.httpClient.post<EpicSvtTestTypeConfig>(this.baseUrl, { ...payload })
    }

}
