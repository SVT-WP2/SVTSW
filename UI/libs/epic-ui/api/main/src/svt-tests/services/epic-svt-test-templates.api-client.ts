import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { EpicSvtTestTemplate, EpicSvtTestTemplateCreateRequest, EpicSvtTestTemplateUpdateRequest } from 'epic-api-types'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTemplatesApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-test-templates`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(): Observable<EpicSvtTestTemplate[]> {
        return this.httpClient.get<EpicSvtTestTemplate[]>(this.baseUrl)
    }

    fetchOne(entityId: number): Observable<EpicSvtTestTemplate> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTestTemplate>(url)
    }

    create(payload: EpicSvtTestTemplateCreateRequest): Observable<EpicSvtTestTemplate> {
        return this.httpClient.post<EpicSvtTestTemplate>(this.baseUrl, { ...payload })
    }

    update(entityId: number, update: EpicSvtTestTemplateUpdateRequest): Observable<EpicSvtTestTemplate> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.patch<EpicSvtTestTemplate>(url, { ...update })
    }

}

