import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigBody, EpicSvtTestSetupConfigCreateRequest } from 'epic-api-types'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupConfigsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-test-setup-configs`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(): Observable<EpicSvtTestSetupConfig[]> {
        return this.httpClient.get<EpicSvtTestSetupConfig[]>(this.baseUrl)
    }

    fetchOne(entityId: number): Observable<EpicSvtTestSetupConfig> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTestSetupConfig>(url)
    }

    fetchConfigBody(entityId: number): Observable<EpicSvtTestSetupConfigBody> {
        const url = `${this.baseUrl}/${entityId}/config-body`
        return this.httpClient.get<EpicSvtTestSetupConfigBody>(url)
    }

    create(payload: EpicSvtTestSetupConfigCreateRequest): Observable<EpicSvtTestSetupConfig> {
        return this.httpClient.post<EpicSvtTestSetupConfig>(this.baseUrl, { ...payload })
    }

}
