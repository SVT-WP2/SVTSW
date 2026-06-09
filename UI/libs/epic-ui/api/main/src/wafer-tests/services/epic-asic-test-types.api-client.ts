import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicAsicTestType } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicAsicTestTypesApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/asic-test-types`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicAsicTestType[]> {
        return this.httpClient.get<EpicAsicTestType[]>(this.baseUrl)
    }

}
