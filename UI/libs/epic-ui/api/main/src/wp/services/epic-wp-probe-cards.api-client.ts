import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { EpicWpProbeCard } from 'epic-api-types'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicWpProbeCardsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/wp-probe-cards`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicWpProbeCard[]> {
        return this.httpClient.get<EpicWpProbeCard[]>(this.baseUrl)
    }

    fetchOne(entityId: number): Observable<EpicWpProbeCard> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicWpProbeCard>(url)
    }

}
