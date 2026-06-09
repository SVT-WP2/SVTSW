import { Injectable } from '@angular/core'
import { EpicWaferType, EpicWaferTypeCreate, EpicWaferTypeMap, EpicWaferTypesApiClient, EpicWaferTypeUpdate } from 'epic-ui/api'
import { delay, Observable, of } from 'rxjs'


export function getMockEpicWaferTypes(): EpicWaferType[] {
    return [
        {
            id: 1,
            name: 'ER1',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
        {
            id: 2,
            name: 'ER1 - Map@1.0',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
        {
            id: 3,
            name: 'ER1 - Map@2.0',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
        {
            id: 4,
            name: 'ER1 - Map@2.0',
            engineeringRun: 'Eng. Run No. 1',
            foundry: 'Foundry Name #1',
            technology: 'Technology #1',
        },
    ]
}

@Injectable()
export class EpicWaferTypesApiClientMock extends EpicWaferTypesApiClient {

    protected data: EpicWaferType[] = [...getMockEpicWaferTypes()]

    override fetchAll(): Observable<EpicWaferType[]> {
        return of(this.data)
            .pipe(
                delay(100),
            )
    }

    override create(payload: EpicWaferTypeCreate): Observable<EpicWaferType> {
        const entity: EpicWaferType = {
            ...payload,
            id: this.data.length ? this.data[this.data.length - 1].id + 1 : 1,
        }
        this.data = [...this.data, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

    override update(id: number, update: Partial<EpicWaferTypeUpdate>): Observable<EpicWaferType> {
        let refEntity: EpicWaferType
        this.data = this.data.map(item => {
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

    override fetchWaferTypeMap(waferTypeId: number): Observable<EpicWaferTypeMap> {
        return of({
            waferMap: JSON.stringify({ some: 'map' }),
        })
            .pipe(
                delay(500),
            )
    }

}

