import { HttpClient } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { map, Observable } from 'rxjs'
import { EpicWpProject, EpicWpProjectCreateRequest } from 'svt-ts-types'

import { EpicApi } from '../../common'


@Injectable({ providedIn: 'root' })
export class EpicWpProjectsApiClient {

    protected readonly baseUrl = `${EpicApi.BASE_URL}/wp-projects`

    // DI
    protected readonly httpClient = inject(HttpClient)

    fetchAll(): Observable<EpicWpProject[]> {
        return this.httpClient.get<EpicWpProject[]>(this.baseUrl)
    }

    /**
     * `GET /wp-projects` has no filter (see `EpicWpProjectsController`), so the machine's projects are picked out
     * of the full list here.
     */
    fetchWpMachineProjects(wpMachineId: number): Observable<EpicWpProject[]> {
        return this.fetchAll()
            .pipe(
                map(projects => projects.filter(project => project.wpMachineId === wpMachineId)),
            )
    }

    fetchOne(entityId: number): Observable<EpicWpProject> {
        const url = `${this.baseUrl}/${entityId}`
        return this.httpClient.get<EpicWpProject>(url)
    }

    create(payload: EpicWpProjectCreateRequest): Observable<EpicWpProject> {
        return this.httpClient.post<EpicWpProject>(this.baseUrl, { ...payload })
    }

}
