import { Injectable } from '@nestjs/common'
import {
    EpicWpMachineCreateEntity,
    EpicWpMachineEntity,
    EpicWpMachineUpdateEntity,
    EpicWpMachineUpdateInstalledProbeCard,
    EpicWpMachineUpdateLoadedWafer,
} from 'epic/entities'
import { delay, map, Observable, of } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'


@Injectable()
export class EpicDbAgentWpMachinesService {

    protected entities: EpicWpMachineEntity[] = [
        {
            id: 1,
            name: 'CERN WP',
            serialNumber: 'C 3451-1-425',
            hostName: '127.0.0.1',
            connectionType: getEnumsCollection().wpConnectionType[0],
            connectionPort: 123,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
            software: getEnumsCollection().wpSwType[0],
            swVersion: '1.0.0',
            vendor: getEnumsCollection().wpVendor[0],
            loadedWaferId: null,
            installedProbeCardId: null,
        },
        {
            id: 2,
            name: 'Prague WP',
            serialNumber: 'PR 1241-1-124',
            hostName: '10.88.254.10',
            connectionType: getEnumsCollection().wpConnectionType[0],
            connectionPort: 123,
            generalLocation: getEnumsCollection().wpGeneralLocation[1],
            software: getEnumsCollection().wpSwType[0],
            swVersion: '1.0.0',
            vendor: getEnumsCollection().wpVendor[0],
            loadedWaferId: null,
            installedProbeCardId: null,
        },
    ]

    getAll(filter?: { ids?: number[] }): Observable<EpicWpMachineEntity[]> {
        const result = filter?.ids
            ? this.entities.filter(item => filter.ids.includes(item.id))
            : [...this.entities]
        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(waferId: number): Observable<EpicWpMachineEntity | undefined> {
        return this.getAll()
            .pipe(
                map(list => list.find(item => item.id === waferId)),
            )
    }

    create(createRequest: EpicWpMachineCreateEntity): Observable<EpicWpMachineEntity> {
        const newWpMachine = {
            id: (this.entities[this.entities.length - 1]?.id || 0) + 1,
            ...createRequest,
            loadedWaferId: null,
            installedProbeCardId: null,
        }

        this.entities.push(newWpMachine)

        return of(newWpMachine)
            .pipe(
                delay(50),
            )
    }

    update(entityId: number, updateRequest: EpicWpMachineUpdateEntity): Observable<EpicWpMachineEntity | null> {
        let refWpMachine: EpicWpMachineEntity = null

        this.entities = this.entities
            .map(item => {
                if (item.id === entityId) {
                    refWpMachine = {
                        ...item,
                        ...updateRequest,
                    }
                    return refWpMachine
                }
                return item
            })

        return of(refWpMachine)
            .pipe(
                delay(50),
            )
    }

    updateLoadedWafer(payload: EpicWpMachineUpdateLoadedWafer): Observable<EpicWpMachineEntity | null> {
        let refWpMachine: EpicWpMachineEntity = null

        this.entities = this.entities
            .map(item => {
                if (item.id === payload.wpMachineId) {
                    refWpMachine = {
                        ...item,
                        loadedWaferId: payload.loadedWaferId,
                    }
                    return refWpMachine
                }
                return item
            })

        return of(refWpMachine)
            .pipe(
                delay(50),
            )
    }

    updateInstalledProbeCard(payload: EpicWpMachineUpdateInstalledProbeCard): Observable<EpicWpMachineEntity | null> {
        let refWpMachine: EpicWpMachineEntity = null

        this.entities = this.entities
            .map(item => {
                if (item.id === payload.wpMachineId) {
                    refWpMachine = {
                        ...item,
                        installedProbeCardId: payload.installedProbeCardId,
                    }
                    return refWpMachine
                }
                return item
            })

        return of(refWpMachine)
            .pipe(
                delay(50),
            )
    }

}
