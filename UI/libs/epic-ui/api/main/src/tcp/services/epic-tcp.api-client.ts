import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { map, Observable } from 'rxjs'

import { EpicApi, EpicApiResponse } from '../../common'
import { EpicTcpReadDto, EpicTcpSendDto } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicTcpApiClient {

    protected readonly baseUrl = EpicApi.BASE_URL

    // DI
    protected readonly httpClient = inject(HttpClient)

    send(payload: EpicTcpSendDto): Observable<number> {
        const url = `${this.baseUrl}/tcp/send`
        return this.httpClient.post<EpicApiResponse<{ statusCode: number }>>(url, { ...payload })
            .pipe(
                map((response) => response.payload?.statusCode),
            )
    }

    sendAndRead(payload: EpicTcpSendDto): Observable<string> {
        const url = `${this.baseUrl}/tcp/send-and-read`
        return this.httpClient.post<EpicApiResponse<{ response: string }>>(url, { ...payload })
            .pipe(
                map((response) => response.payload?.response),
            )
    }

    read(payload: EpicTcpReadDto): Observable<string> {
        const url = `${this.baseUrl}/tcp/read`
        return this.httpClient.post<EpicApiResponse<{ response: string }>>(url, { ...payload })
            .pipe(
                map((response) => response.payload?.response),
            )
    }

}
