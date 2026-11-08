import { Injectable } from '@nestjs/common'
import { delay, map, Observable, of } from 'rxjs'
import { EpicEquipmentType, EpicEquipmentTypeCreateRequest } from 'svt-ts-types'


@Injectable()
export class EpicDbAgentEquipmentTypesService {

    protected data: EpicEquipmentType[] = [
        {
            id: 1,
            name: 'Equipment #1',
        },
        {
            id: 2,
            name: 'Equipment #2',
        },
        {
            id: 3,
            name: 'Equipment #3',
        },
        {
            id: 4,
            name: 'Equipment #4',
        },
    ]

    protected waferTypeMaps: { [waferTypeId: number]: string | null } = {}

    getAll(filter?: { ids?: number[] }): Observable<EpicEquipmentType[]> {
        const result = filter?.ids
            ? this.data.filter(item => filter.ids.includes(item.id))
            : this.data

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicEquipmentType | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    create(createRequest: EpicEquipmentTypeCreateRequest): Observable<EpicEquipmentType> {
        const newEquipment: EpicEquipmentType = {
            id: (this.data[this.data.length - 1]?.id || 0) + 1,
            ...createRequest,
        }

        this.data.push(newEquipment)

        return of(newEquipment)
            .pipe(
                delay(50),
            )
    }

}
