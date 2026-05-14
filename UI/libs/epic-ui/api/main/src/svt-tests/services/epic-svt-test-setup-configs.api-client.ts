import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigBody, EpicSvtTestSetupConfigCreate } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupConfigsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-test-setup-configs`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(queryFilter: { ids?: number[]; setupId?: number } = {}): Observable<EpicSvtTestSetupConfig[]> {
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
        })
        return this.httpClient.get<EpicSvtTestSetupConfig[]>(this.baseUrl, { params })
    }

    fetchOne(entityId: number): Observable<EpicSvtTestSetupConfig> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTestSetupConfig>(url)
    }

    fetchConfigBody(entityId: number): Observable<EpicSvtTestSetupConfigBody> {
        const url = `${this.baseUrl}/${entityId}/config-body`
        return this.httpClient.get<EpicSvtTestSetupConfigBody>(url)
    }

    create(payload: EpicSvtTestSetupConfigCreate): Observable<EpicSvtTestSetupConfig> {
        return this.httpClient.post<EpicSvtTestSetupConfig>(this.baseUrl, { ...payload })
    }

}
