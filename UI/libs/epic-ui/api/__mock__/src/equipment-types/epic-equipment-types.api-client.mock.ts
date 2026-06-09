import { Injectable } from '@angular/core'
import { EpicEquipmentType, EpicEquipmentTypeCreate, EpicEquipmentTypesApiClient } from 'epic-ui/api'
import { delay, Observable, of } from 'rxjs'


export function getMockEpicEquipmentTypes(): EpicEquipmentType[] {
    return [
        {
            id: 1,
            name: 'Equipment Type #1',
        },
        {
            id: 2,
            name: 'Equipment Type #2',
        },
        {
            id: 3,
            name: 'Equipment Type #3',
        },
        {
            id: 4,
            name: 'Equipment Type #4',
        },
    ]
}

@Injectable()
export class EpicEquipmentTypesApiClientMock extends EpicEquipmentTypesApiClient {

    protected data: EpicEquipmentType[] = [...getMockEpicEquipmentTypes()]

    override fetchList(): Observable<EpicEquipmentType[]> {
        return of(this.data)
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicEquipmentTypeCreate): Observable<EpicEquipmentType> {
        const entity: EpicEquipmentType = {
            ...payload,
            id: this.data.length ? this.data[this.data.length - 1].id + 1 : 1,
        }
        this.data = [...this.data, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

}

