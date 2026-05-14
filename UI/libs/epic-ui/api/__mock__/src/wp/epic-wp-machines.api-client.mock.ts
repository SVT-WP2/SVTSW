import { Injectable } from '@angular/core'
import { EpicWpMachine, EpicWpMachineCreate, EpicWpMachinesApiClient, EpicWpMachineUpdate } from 'epic-ui/api'
import { delay, Observable, of, switchMap, throwError } from 'rxjs'

import { EpicEnumsMock } from '../enums'


export function getMockEpicWpMachinesList(): EpicWpMachine[] {
    return [
        {
            id: 1,
            name: 'CERN WP',
            serialNumber: 'C 3451-1-425',
            hostName: '127.0.0.1',
            connectionType: EpicEnumsMock.getEnumsCollection().wpConnectionType[0],
            connectionPort: 123,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
            software: EpicEnumsMock.getEnumsCollection().wpSwType[0],
            swVersion: '1.0.0',
            vendor: EpicEnumsMock.getEnumsCollection().wpVendor[0],
            loadedWaferId: null,
            installedProbeCardId: null,
        },
        {
            id: 2,
            name: 'Prague WP',
            serialNumber: 'PR 1241-1-124',
            hostName: '10.88.254.10',
            connectionType: EpicEnumsMock.getEnumsCollection().wpConnectionType[0],
            connectionPort: 123,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[1],
            software: EpicEnumsMock.getEnumsCollection().wpSwType[0],
            swVersion: '1.0.0',
            vendor: EpicEnumsMock.getEnumsCollection().wpVendor[0],
            loadedWaferId: null,
            installedProbeCardId: null,
        },
    ]
}

@Injectable()
export class EpicWpMachinesApiClientMock extends EpicWpMachinesApiClient {

    protected entitiesList = getMockEpicWpMachinesList()

    override fetchAll(): Observable<EpicWpMachine[]> {
        return of(this.entitiesList)
            .pipe(
                delay(100),
            )
    }

    override fetchOne(entityId: number): Observable<EpicWpMachine> {
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

    override create(payload: EpicWpMachineCreate): Observable<EpicWpMachine> {
        const entity: EpicWpMachine = {
            ...payload,
            id: this.entitiesList.length ? this.entitiesList[this.entitiesList.length - 1].id + 1 : 1,
            loadedWaferId: null,
            installedProbeCardId: null,
        }
        this.entitiesList = [...this.entitiesList, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

    override update(id: number, update: Partial<EpicWpMachineUpdate>): Observable<EpicWpMachine> {
        let refEntity: EpicWpMachine
        this.entitiesList = this.entitiesList.map(item => {
            if (item.id === id) {
                refEntity = {
                    ...item,
                    ...update,
                }
                return refEntity
            }
            return item
        })
        return of(refEntity!)
            .pipe(
                delay(500),
            )
    }

    override updateLoadedWafer(id: number, loadedWaferId: number | null): Observable<EpicWpMachine> {
        let refEntity: EpicWpMachine
        this.entitiesList = this.entitiesList.map(item => {
            if (item.id === id) {
                refEntity = {
                    ...item,
                    loadedWaferId,
                }
                return refEntity
            }
            return item
        })
        return of(refEntity!)
            .pipe(
                delay(500),
            )
    }

    override updateInstalledProbeCard(id: number, installedProbeCardId: number | null): Observable<EpicWpMachine> {
        let refEntity: EpicWpMachine
        this.entitiesList = this.entitiesList.map(item => {
            if (item.id === id) {
                refEntity = {
                    ...item,
                    installedProbeCardId,
                }
                return refEntity
            }
            return item
        })
        return of(refEntity!)
            .pipe(
                delay(500),
            )
    }

}
