import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import {
    EpicEquipment,
    EpicEquipmentCreateRequest,
    EpicEquipmentListQuery,
    EpicEquipmentLocationHistoryRecord,
    EpicEquipmentLocationUpdateRequest,
} from 'epic-api-types'
import { QueryHelpers } from 'epic-ui/utils'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicEquipmentApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/equipment`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchList(queryFilter?: EpicEquipmentListQuery): Observable<EpicEquipment[]> {
        const url = `${this.baseUrl}`
        const params = QueryHelpers.applyQueryParams({
            ...queryFilter,
        })

        return this.httpClient.get<EpicEquipment[]>(url, { params })
    }

    create(payload: EpicEquipmentCreateRequest): Observable<EpicEquipment> {
        const url = this.baseUrl
        return this.httpClient.post<EpicEquipment>(url, { ...payload })
    }

    updateEquipmentLocation(equipmentId: number, update: EpicEquipmentLocationUpdateRequest): Observable<EpicEquipment> {
        const url = `${this.baseUrl}/${equipmentId}/location`
        return this.httpClient.post<EpicEquipment>(url, { ...update })
    }

    fetchEquipmentLocationHistory(equipmentId: number): Observable<EpicEquipmentLocationHistoryRecord[]> {
        const url = `${this.baseUrl}/${equipmentId}/location-history`
        return this.httpClient.get<EpicEquipmentLocationHistoryRecord[]>(url)
    }

}
