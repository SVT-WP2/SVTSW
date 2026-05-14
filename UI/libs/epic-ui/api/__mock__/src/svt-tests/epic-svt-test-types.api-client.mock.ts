import { inject, Injectable } from '@angular/core'
import {
    EpicSvtTestType,
    EpicSvtTestTypeConfigsApiClient,
    EpicSvtTestTypeCreate,
    EpicSvtTestTypesApiClient,
    EpicSvtTestTypeUpdate,
} from 'epic-ui/api'
import { EpicEnumsMock } from 'epic-ui/api/__mock__'
import { delay, map, Observable, of, throwError } from 'rxjs'


export function getMockEpicSvtTestType(): EpicSvtTestType[] {
    return [
        {
            id: 1,
            name: 'Test Type #1',
            dutTypes: [EpicEnumsMock.getEnumsCollection().dutType[0]],
        },
        {
            id: 2,
            name: 'Test Type #2',
            dutTypes: [EpicEnumsMock.getEnumsCollection().dutType[0], EpicEnumsMock.getEnumsCollection().dutType[2]],
        },
        {
            id: 3,
            name: 'Test Type #3',
            dutTypes: [EpicEnumsMock.getEnumsCollection().dutType[1]],
        },
        {
            id: 4,
            name: 'Test Type #4',
            dutTypes: [EpicEnumsMock.getEnumsCollection().dutType[2]],
        },
    ]
}

@Injectable()
export class EpicSvtTestTypesApiClientMock extends EpicSvtTestTypesApiClient {

    protected readonly epicSvtTestTypeConfigsApiClient = inject(EpicSvtTestTypeConfigsApiClient)

    protected data: EpicSvtTestType[] = [...getMockEpicSvtTestType()]

    override fetchList(): Observable<EpicSvtTestType[]> {
        return of(this.data)
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicSvtTestTypeCreate): Observable<EpicSvtTestType> {
        const newId = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
        return this.epicSvtTestTypeConfigsApiClient
            .create({
                ...payload.testTypeConfig,
                testTypeId: newId,
            })
            .pipe(
                map((config) => {
                    const entity: EpicSvtTestType = {
                        id: newId,
                        name: payload.name,
                        dutTypes: payload.dutTypes,
                    }
                    this.data = [...this.data, entity]
                    return entity
                }),
                delay(500),
            )
    }

    override update(entityId: number, update: EpicSvtTestTypeUpdate): Observable<EpicSvtTestType> {
        const entity = this.data.find(item => item.id === entityId)
        if (!entity) {
            return throwError(() => new Error(`Entity with id ${entityId} not found`))
        }

        const entityUpdated: EpicSvtTestType =  {
            ...entity,
            ...update,
        }

        this.data = this.data
            .map(item => {
                if (item.id === entityId) {
                    return entityUpdated
                }
                return item
            })

        return of(entityUpdated)
    }

}

