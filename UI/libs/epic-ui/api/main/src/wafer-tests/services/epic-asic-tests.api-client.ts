import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicAsicTest, EpicAsicTestListQuery } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicAsicTestsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/asic-tests`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(queryFilter: EpicAsicTestListQuery.QueryFilter): Observable<EpicAsicTest[]> {
        let httpParams = new HttpParams()

        if (queryFilter.asicId) {
            httpParams = httpParams.set('asicId', queryFilter.asicId)
        }

        if (queryFilter.waferTestId) {
            httpParams = httpParams.set('waferTestId', queryFilter.waferTestId)
        }

        return this.httpClient.get<EpicAsicTest[]>(this.baseUrl, { params: httpParams })
    }

}
