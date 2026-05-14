import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { map, Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicIvMnt, EpicIvMntCreateRequestPayload } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicIvMntApiClient {

    protected readonly baseUrl = EpicApi.BASE_URL

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(): Observable<EpicIvMnt[]> {
        const url = `${this.baseUrl}/measurement/iv`
        return this.httpClient.get<EpicIvMnt[]>(url)
            .pipe(
                map((response) => response),
            )
    }

    createAndStart(createRequest: EpicIvMntCreateRequestPayload): Observable<EpicIvMnt> {
        const url = `${this.baseUrl}/measurement/iv/create-and-start`
        return this.httpClient.post<EpicIvMnt>(url, { ...createRequest })
            .pipe(
                map((response) => response),
            )
    }

    create(createRequest: EpicIvMntCreateRequestPayload): Observable<EpicIvMnt> {
        const url = `${this.baseUrl}/measurement/iv`
        return this.httpClient.post<EpicIvMnt>(url, { ...createRequest })
            .pipe(
                map((response) => response),
            )
    }

    start(measurementId: string): Observable<EpicIvMnt> {
        const url = `${this.baseUrl}/measurement/iv/${measurementId}/start`
        return this.httpClient.post<EpicIvMnt>(url, {})
            .pipe(
                map((response) => response),
            )
    }

    abort(measurementId: string): Observable<EpicIvMnt> {
        const url = `${this.baseUrl}/measurement/iv/${measurementId}/abort`
        return this.httpClient.post<EpicIvMnt>(url, {})
            .pipe(
                map((response) => response),
            )
    }

}
