import { Injectable } from '@angular/core'
import { EpicWpProject, EpicWpProjectCreate, EpicWpProjectsApiClient } from 'epic-ui/api'
import { delay, Observable, of, switchMap, throwError } from 'rxjs'

import { getMockEpicWaferTypes } from '../wafer-types'

import { getMockEpicWpMachinesList } from './epic-wp-machines.api-client.mock'


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
            wpMachine: getMockEpicWpMachinesList().find(item => item.id === 1),
            waferType: getMockEpicWaferTypes().find(item => item.id === 1),
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
            wpMachine: getMockEpicWpMachinesList().find(item => item.id === 1),
            waferType: getMockEpicWaferTypes().find(item => item.id === 1),
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
            wpMachine: getMockEpicWpMachinesList().find(item => item.id === 2),
            waferType: getMockEpicWaferTypes().find(item => item.id === 1),
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

    override create(payload: EpicWpProjectCreate): Observable<EpicWpProject> {
        const entity: EpicWpProject = {
            ...payload,
            id: this.entitiesList.length ? this.entitiesList[this.entitiesList.length - 1].id + 1 : 1,
            waferType: getMockEpicWaferTypes().find(item => item.id === payload.waferTypeId),
            wpMachine: getMockEpicWpMachinesList().find(item => item.id === payload.wpMachineId),
        }
        this.entitiesList = [...this.entitiesList, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

}
