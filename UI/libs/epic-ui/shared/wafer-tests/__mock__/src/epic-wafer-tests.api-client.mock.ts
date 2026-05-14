import { Injectable } from '@angular/core'
import { EpicWaferTest, EpicWaferTestCreate, EpicWaferTestsApiClient, EpicWaferTestStatus, EpicWaferTestUpdate } from 'epic-ui/api'
import moment from 'moment'
import { delay, Observable, of, switchMap, throwError } from 'rxjs'


export function getMockEpicWaferTestsList(): EpicWaferTest[] {
    return [
        {
            id: 1,
            name: 'Test #1',
            description: 'Some description',
            wpMachineId: 1,
            waferId: 1,
            asicTestTypeId: 1,
            asicIds: [],
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: moment('2025-01-01 10:00:00').toISOString(),
            finishedAt: moment('2025-01-01 10:02:00').toISOString(),
            status: EpicWaferTestStatus.Done,
        },
        {
            id: 2,
            name: 'Test #2',
            description: null,
            wpMachineId: 1,
            waferId: 1,
            asicTestTypeId: 1,
            asicIds: [],
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: moment('2025-01-01 10:00:00').toISOString(),
            finishedAt: moment('2025-01-01 10:02:00').toISOString(),
            status: EpicWaferTestStatus.Done,
        },
        {
            id: 3,
            name: 'Test #3',
            description: null,
            wpMachineId: 1,
            waferId: 1,
            asicTestTypeId: 1,
            asicIds: [],
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: null,
            finishedAt: null,
            status: EpicWaferTestStatus.ProcessingRequested,
        },
        {
            id: 4,
            name: 'Test #4',
            description: null,
            wpMachineId: 1,
            waferId: 1,
            asicTestTypeId: 1,
            asicIds: [],
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: null,
            finishedAt: null,
            status: EpicWaferTestStatus.Processing,
        },
        {
            id: 4,
            name: 'Test #4',
            description: null,
            wpMachineId: 1,
            waferId: 1,
            asicTestTypeId: 1,
            asicIds: [],
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: null,
            finishedAt: null,
            status: EpicWaferTestStatus.None,
        },
    ]
}

@Injectable()
export class EpicWaferTestsApiClientMock extends EpicWaferTestsApiClient {

    protected data: EpicWaferTest[] = getMockEpicWaferTestsList()

    override fetchAll(): Observable<EpicWaferTest[]> {
        return of(this.data)
            .pipe(
                delay(100),
            )
    }

    override fetchOne(entityId: number): Observable<EpicWaferTest> {
        return of(this.data.find(item => item.id === entityId)!)
            .pipe(
                switchMap((entity) =>
                    entity
                        ? of(entity)
                        : throwError(() => new Error(`Entity with id ${entityId} not found`)),
                ),
                delay(100),
            )
    }

    override create(payload: EpicWaferTestCreate): Observable<EpicWaferTest> {
        const entity: EpicWaferTest = {
            ...payload,
            createdAt: moment().toISOString(),
            startedAt: null,
            finishedAt: null,
            status: EpicWaferTestStatus.None,
            id: this.data.length ? this.data[this.data.length - 1].id + 1 : 1,
        }
        this.data = [...this.data, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

    override update(id: number, update: Partial<EpicWaferTestUpdate>): Observable<EpicWaferTest> {
        let refEntity: EpicWaferTest
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

}

