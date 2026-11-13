import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { EpicEnumName, EpicEnumsCollection, EpicEnumsCollectionResponse } from 'epic-api-types'
import { map, Observable } from 'rxjs'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicEnumsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/enums`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicEnumsCollection> {
        const url = this.baseUrl
        return this.httpClient.get<EpicEnumsCollectionResponse>(url)
            .pipe(
                map(({ collection }) => collection as EpicEnumsCollection),
            )
    }

    // return the particular enum values by enum name
    fetchOneByName(enumName: EpicEnumName): Observable<string[]> {
        const url = this.baseUrl
        const params = new HttpParams({
            fromObject: {
                // one comma-separated value, see EpicEnumsCollectionQuery
                enumNames: enumName,
            },
        })

        return this.httpClient.get<EpicEnumsCollectionResponse>(url, { params })
            .pipe(
                map(({ collection }) => collection[enumName] ?? []),
            )
    }

}
