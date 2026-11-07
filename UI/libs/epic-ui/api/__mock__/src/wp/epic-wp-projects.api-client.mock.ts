import { Injectable } from '@angular/core'
import { EpicWpProject, EpicWpProjectCreateRequest } from 'epic-api-types'
import { EpicWpProjectsApiClient } from 'epic-ui/api'
import { delay, Observable, of, switchMap, throwError } from 'rxjs'


export function getMockEpicWpProjectsList(): EpicWpProject[] {
    return [
        {
            id: 1,
            wpMachineId: 1,
            waferTypeId: 1,
            name: 'Project #1',
            asicFamilyType: 'BABYMOSS',
            orientation: 'North',
            alignmentDie: '1.1',
            homeDie: '3.3',
            local2GlobalMap: JSON.stringify({ field: 'value' }),
        },
        {
            id: 2,
            wpMachineId: 1,
            waferTypeId: 1,
            name: 'Project #2',
            asicFamilyType: 'BABYMOSS',
            orientation: 'South',
            alignmentDie: '1.1',
            homeDie: '3.3',
            local2GlobalMap: JSON.stringify({ field: 'value' }),
        },
        {
            id: 3,
            wpMachineId: 2,
            waferTypeId: 1,
            name: 'Project #1',
            asicFamilyType: 'BABYMOSS',
            orientation: 'South',
            alignmentDie: '1.1',
            homeDie: '3.3',
            local2GlobalMap: JSON.stringify({ field: 'value' }),
        },
    ]
}


@Injectable()
export class EpicWpProjectsApiClientMock extends EpicWpProjectsApiClient {

    protected entitiesList = getMockEpicWpProjectsList()

    override fetchAll(): Observable<EpicWpProject[]> {
        return of(this.entitiesList)
            .pipe(
                delay(100),
            )
    }

    override fetchOne(entityId: number): Observable<EpicWpProject> {
        return of(this.entitiesList.find(item => item.id === entityId)!)
            .pipe(
                switchMap((entity) =>
                    entity
                        ? of(entity)
                        : throwError(() => new Error(`Entity with id ${entityId} not found`)),
                ),
                delay(100),
            )
    }

    override create(payload: EpicWpProjectCreateRequest): Observable<EpicWpProject> {
        const entity: EpicWpProject = {
            ...payload,
            id: this.entitiesList.length ? this.entitiesList[this.entitiesList.length - 1].id + 1 : 1,
        }
        this.entitiesList = [...this.entitiesList, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

}
