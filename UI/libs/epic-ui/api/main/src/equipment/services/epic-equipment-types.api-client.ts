import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicEquipmentType, EpicEquipmentTypeCreate, EpicEquipmentTypesListQuery } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicEquipmentTypesApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/equipment-types`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(queryFilter?: EpicEquipmentTypesListQuery.QueryFilter): Observable<EpicEquipmentType[]> {
        const url = `${this.baseUrl}`
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
        })

        return this.httpClient.get<EpicEquipmentType[]>(url, { params })
    }

    create(payload: EpicEquipmentTypeCreate): Observable<EpicEquipmentType> {
        const url = this.baseUrl
        return this.httpClient.post<EpicEquipmentType>(url, { ...payload })
    }

}
