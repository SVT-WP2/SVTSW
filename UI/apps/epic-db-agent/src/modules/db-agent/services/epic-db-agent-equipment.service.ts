import { Injectable } from '@nestjs/common'
import { EpicEquipmentCreateEntity, EpicEquipmentEntity, EpicEquipmentLocationHistoryRecordEntity } from 'epic/entities'
import moment from 'moment'
import { delay, map, Observable, of } from 'rxjs'

import { getEnumsCollection } from './epic-db-agent-enums.service'


@Injectable()
export class EpicDbAgentEquipmentService {

    protected data: EpicEquipmentEntity[] = [
        {
            id: 1,
            name: 'Equipment #1',
            equipmentTypeId: 1,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({ someProp: 'value-123' }),
        },
        {
            id: 2,
            name: 'Equipment #2',
            equipmentTypeId: 1,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({ someProp: 'value-123' }),
        },
        {
            id: 3,
            name: 'Equipment #3',
            equipmentTypeId: 1,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({ someProp: 'value-123' }),
        },
        {
            id: 4,
            name: 'Equipment #4',
            equipmentTypeId: 1,
            generalLocation: getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({ someProp: 'value-123' }),
        },
    ]

    protected locationHistory: { [equipmentId: string]: EpicEquipmentLocationHistoryRecordEntity[] } = this.data
        .reduce<{ [equipmentId: string]: EpicEquipmentLocationHistoryRecordEntity[] }>(
            (acc, equipment) => {
                return {
                    ...acc,
                    [equipment.id]: [{
                        equipmentId: equipment.id,
                        generalLocation: equipment.generalLocation,
                        date: moment().subtract(Math.round(Math.random() * 100), 'days').format('YYYY-MM-DD'),
                        username: null,
                        note: 'Init location',
                    }],
                }
            },
            {},
        )

    getAll(filter?: { ids?: number[] }): Observable<EpicEquipmentEntity[]> {
        const result = filter?.ids
            ? this.data.filter(item => filter.ids.includes(item.id))
            : this.data

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicEquipmentEntity | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    create(createRequest: EpicEquipmentCreateEntity): Observable<EpicEquipmentEntity> {
        const newEquipment: EpicEquipmentEntity = {
            id: (this.data[this.data.length - 1]?.id || 0) + 1,
            ...createRequest,
        }

        this.data.push(newEquipment)

        return of(newEquipment)
            .pipe(
                delay(50),
            )
    }

    update(equipmentId: number, updateRequest: Partial<Omit<EpicEquipmentEntity, 'id'>>): Observable<EpicEquipmentEntity | null> {
        let refEquipment: EpicEquipmentEntity = null

        this.data = this.data
            .map(item => {
                if (item.id === equipmentId) {
                    refEquipment = {
                        ...item,
                        ...updateRequest,
                    }
                    return refEquipment
                }
                return item
            })

        return of(refEquipment)
            .pipe(
                delay(50),
            )
    }

    getEquipmentLocationHistory(equipmentId: number): Observable<EpicEquipmentLocationHistoryRecordEntity[]> {
        return of(this.locationHistory[equipmentId] ?? [])
            .pipe(
                delay(500),
            )
    }

    updateEquipmentLocation(location: EpicEquipmentLocationHistoryRecordEntity): Observable<EpicEquipmentEntity> {
        this.locationHistory[location.equipmentId] = [
            ...(this.locationHistory[location.equipmentId] ?? []),
            location,
        ]

        return this.update(location.equipmentId, { generalLocation: location.generalLocation })
    }

}
