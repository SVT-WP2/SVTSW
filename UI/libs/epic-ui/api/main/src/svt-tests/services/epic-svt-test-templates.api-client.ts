import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicSvtTestTemplate, EpicSvtTestTemplateCreate, EpicSvtTestTemplateUpdate } from '../models'


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

    create(payload: EpicSvtTestTemplateCreate): Observable<EpicSvtTestTemplate> {
        return this.httpClient.post<EpicSvtTestTemplate>(this.baseUrl, { ...payload })
    }

    update(entityId: number, update: EpicSvtTestTemplateUpdate): Observable<EpicSvtTestTemplate> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.patch<EpicSvtTestTemplate>(url, { ...update })
    }

}

