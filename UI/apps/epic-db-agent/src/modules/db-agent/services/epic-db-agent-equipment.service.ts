import { Injectable } from '@nestjs/common'
import moment from 'moment'
import { delay, map, Observable, of } from 'rxjs'
import { EpicEquipment, EpicEquipmentCreateRequest, EpicEquipmentLocationHistoryRecord } from 'svt-ts-types'
import { SvtDbAgentKafkaEquipment } from 'svt-ts-types/kafka'

import { getEnumsCollection } from './epic-db-agent-enums.service'
import { EpicDbAgentUsersService, mockEpicDbAgentUserIdOf } from './epic-db-agent-users.service'


@Injectable()
export class EpicDbAgentEquipmentService {

    protected data: EpicEquipment[] = [
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

    protected locationHistory: { [equipmentId: string]: EpicEquipmentLocationHistoryRecord[] } = this.data
        .reduce<{ [equipmentId: string]: EpicEquipmentLocationHistoryRecord[] }>(
            (acc, equipment) => {
                return {
                    ...acc,
                    [equipment.id]: [{
                        equipmentId: equipment.id,
                        generalLocation: equipment.generalLocation,
                        date: moment().subtract(Math.round(Math.random() * 100), 'days').format('YYYY-MM-DD'),
                        username: null,
                        note: 'Init location',
                        userId: mockEpicDbAgentUserIdOf(equipment.id),
                        userName: null,
                    }],
                }
            },
            {},
        )

    constructor(private readonly epicDbAgentUsersService: EpicDbAgentUsersService) {
    }

    getAll(filter?: { ids?: number[] }): Observable<EpicEquipment[]> {
        const result = filter?.ids
            ? this.data.filter(item => filter.ids.includes(item.id))
            : this.data

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicEquipment | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    create(createRequest: EpicEquipmentCreateRequest): Observable<EpicEquipment> {
        const newEquipment: EpicEquipment = {
            id: (this.data[this.data.length - 1]?.id || 0) + 1,
            ...createRequest,
        }

        this.data.push(newEquipment)

        return of(newEquipment)
            .pipe(
                delay(50),
            )
    }

    update(equipmentId: number, updateRequest: Partial<Omit<EpicEquipment, 'id'>>): Observable<EpicEquipment | null> {
        let refEquipment: EpicEquipment = null

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

    /** The name of the user of each row is read now, as the DB agent does: a renamed user shows its new name. */
    getEquipmentLocationHistory(equipmentId: number): Observable<EpicEquipmentLocationHistoryRecord[]> {
        const history = (this.locationHistory[equipmentId] ?? [])
            .map(record => ({ ...record, userName: this.epicDbAgentUsersService.nameOf(record.userId) }))
        return of(history)
            .pipe(
                delay(500),
            )
    }

    /** `userId`: the user of the header `svt_userId`, `null` without one. */
    updateEquipmentLocation(
        location: SvtDbAgentKafkaEquipment.UpdateEquipmentLocationMessageData,
        userId: number | null,
    ): Observable<EpicEquipment> {
        this.locationHistory[location.equipmentId] = [
            ...(this.locationHistory[location.equipmentId] ?? []),
            { ...location, username: location.username ?? null, userId, userName: null },
        ]

        return this.update(location.equipmentId, { generalLocation: location.generalLocation })
    }

}
