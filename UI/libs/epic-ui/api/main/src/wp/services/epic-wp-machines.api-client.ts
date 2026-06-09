import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicWpMachine, EpicWpMachineCreate, EpicWpMachineUpdate } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicWpMachinesApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/wp-machines`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicWpMachine[]> {
        return this.httpClient.get<EpicWpMachine[]>(this.baseUrl)
    }

    fetchOne(entityId: number): Observable<EpicWpMachine> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicWpMachine>(url)
    }

    update(entityId: number, update: Partial<EpicWpMachineUpdate>): Observable<EpicWpMachine> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.patch<EpicWpMachine>(url, { ...update })
    }

    updateLoadedWafer(entityId: number, loadedWaferId: number | null): Observable<EpicWpMachine> {
        const url = `${this.baseUrl}/${entityId}/loaded-wafer`
        return this.httpClient.post<EpicWpMachine>(url, { loadedWaferId })
    }

    updateInstalledProbeCard(entityId: number, installedProbeCardId: number | null): Observable<EpicWpMachine> {
        const url = `${this.baseUrl}/${entityId}/installed-probe-card`
        return this.httpClient.post<EpicWpMachine>(url, { installedProbeCardId })
    }

    create(payload: EpicWpMachineCreate): Observable<EpicWpMachine> {
        return this.httpClient.post<EpicWpMachine>(this.baseUrl, { ...payload })
    }

}
