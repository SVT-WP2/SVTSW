import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicSvtTestSetup, EpicSvtTestSetupCreate, EpicSvtTestSetupUpdate } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/svt-test-setups`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(): Observable<EpicSvtTestSetup[]> {
        return this.httpClient.get<EpicSvtTestSetup[]>(this.baseUrl)
    }

    fetchOne(entityId: number): Observable<EpicSvtTestSetup> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicSvtTestSetup>(url)
    }

    update(entityId: number, update: EpicSvtTestSetupUpdate): Observable<EpicSvtTestSetup> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.patch<EpicSvtTestSetup>(url, { ...update })
    }

    create(payload: EpicSvtTestSetupCreate): Observable<EpicSvtTestSetup> {
        return this.httpClient.post<EpicSvtTestSetup>(this.baseUrl, { ...payload })
    }

}
