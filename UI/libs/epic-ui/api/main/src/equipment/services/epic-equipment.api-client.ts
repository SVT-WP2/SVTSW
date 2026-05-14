import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicEquipment, EpicEquipmentCreate, EpicEquipmentListQuery, EpicEquipmentLocation, EpicEquipmentLocationUpdate } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicEquipmentApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/equipment`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(queryFilter?: EpicEquipmentListQuery.QueryFilter): Observable<EpicEquipment[]> {
        const url = `${this.baseUrl}`
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
        })

        return this.httpClient.get<EpicEquipment[]>(url, { params })
    }

    create(payload: EpicEquipmentCreate): Observable<EpicEquipment> {
        const url = this.baseUrl
        return this.httpClient.post<EpicEquipment>(url, { ...payload })
    }

    updateEquipmentLocation(equipmentId: number, update: EpicEquipmentLocationUpdate): Observable<EpicEquipment> {
        const url = `${this.baseUrl}/${equipmentId}/location`
        return this.httpClient.post<EpicEquipment>(url, { ...update })
    }

    fetchEquipmentLocationHistory(equipmentId: number): Observable<EpicEquipmentLocation[]> {
        const url = `${this.baseUrl}/${equipmentId}/location-history`
        return this.httpClient.get<EpicEquipmentLocation[]>(url)
    }

}
