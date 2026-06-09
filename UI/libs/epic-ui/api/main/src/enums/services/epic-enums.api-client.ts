import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { map, Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicEnumName, EpicEnumsCollection } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicEnumsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/enums`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicEnumsCollection> {
        const url = this.baseUrl
        return this.httpClient.get<{ collection: EpicEnumsCollection }>(url)
            .pipe(
                map(({collection}) => collection),
            )
    }

    // return the particular enum values by enum name
    fetchOneByName(enumName: EpicEnumName): Observable<string[]> {
        const url = this.baseUrl
        const params = new HttpParams({
            fromObject: {
                enumNames: enumName,
            },
        })

        return this.httpClient.get<Partial<EpicEnumsCollection>>(url, { params })
            .pipe(
                map(item => item[enumName] ?? []),
            )
    }

}
