import { Injectable } from '@angular/core'
import { EpicEquipment, EpicEquipmentCreate, EpicEquipmentApiClient } from 'epic-ui/api'
import { EpicEnumsMock } from 'epic-ui/api/__mock__'
import { delay, Observable, of } from 'rxjs'


export function getMockEpicEquipment(): EpicEquipment[] {
    return [
        {
            id: 1,
            name: 'Equipment #1',
            equipmentTypeId: 1,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({someProp: 'value-123'}),
        },
        {
            id: 2,
            name: 'Equipment #2',
            equipmentTypeId: 1,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({someProp: 'value-123'}),
        },
        {
            id: 3,
            name: 'Equipment #3',
            equipmentTypeId: 1,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({someProp: 'value-123'}),
        },
        {
            id: 4,
            name: 'Equipment #4',
            equipmentTypeId: 1,
            generalLocation: EpicEnumsMock.getEnumsCollection().wpGeneralLocation[0],
            specification: JSON.stringify({someProp: 'value-123'}),
        },
    ]
}

@Injectable()
export class EpicEquipmentApiClientMock extends EpicEquipmentApiClient {

    protected data: EpicEquipment[] = [...getMockEpicEquipment()]

    override fetchList(): Observable<EpicEquipment[]> {
        return of(this.data)
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicEquipmentCreate): Observable<EpicEquipment> {
        const entity: EpicEquipment = {
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

