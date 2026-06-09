import { HttpClient, HttpParams } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { Observable } from 'rxjs'

import { EpicApi } from '../../common'
import { EpicWpProject, EpicWpProjectCreate, EpicWpProjectsListQuery } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicWpProjectsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/wp-projects`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(queryFilter?: EpicWpProjectsListQuery.Filter): Observable<EpicWpProject[]> {
        let queryParams = new HttpParams()
        if (queryFilter?.wpMachineId) {
            queryParams = queryParams.append('wpMachineId', queryFilter.wpMachineId.toString())
        }

        return this.httpClient.get<EpicWpProject[]>(this.baseUrl, { params: queryParams })
    }

    fetchWpMachineProjects(wpMachineId: number): Observable<EpicWpProject[]> {
        const filter: EpicWpProjectsListQuery.Filter = {
            wpMachineId,
        }
        return this.fetchAll(filter)
    }

    fetchOne(entityId: number): Observable<EpicWpProject> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicWpProject>(url)
    }

    create(payload: EpicWpProjectCreate): Observable<EpicWpProject> {
        return this.httpClient.post<EpicWpProject>(this.baseUrl, { ...payload })
    }

}
