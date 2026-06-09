import { Injectable } from '@angular/core'
import {
    EpicSvtTestTypeConfig,
    EpicSvtTestTypeConfigBody,
    EpicSvtTestTypeConfigCreate,
    EpicSvtTestTypeConfigsApiClient,
} from 'epic-ui/api'
import { omit } from 'lodash-es'
import moment from 'moment'
import { delay, Observable, of, throwError } from 'rxjs'


export function getMockEpicSvtTestTypeConfig(): EpicSvtTestTypeConfig[] {
    return [
        {
            id: 1,
            testTypeId: 1,
            name: 'Test setup #1 :: Config #1',
            note: 'Note for test setup #1',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 2,
            testTypeId: 2,
            name: 'Test setup #2 :: Config #1',
            note: 'Note for test setup #2',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 3,
            testTypeId: 3,
            name: 'Test setup #3 :: Config #1',
            note: 'Note for test setup #3',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 4,
            testTypeId: 4,
            name: 'Test setup #4 :: Config #1',
            note: 'Note for test setup #4',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 5,
            testTypeId: 1,
            name: 'Test setup #1 :: Config #2',
            note: 'Note for test setup #5',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 6,
            testTypeId: 2,
            name: 'Test setup #2 :: Config #2',
            note: 'Note for test setup #6',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 7,
            testTypeId: 3,
            name: 'Test setup #3 :: Config #2',
            note: 'Note for test setup #7',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 8,
            testTypeId: 4,
            name: 'Test setup #4 :: Config #2',
            note: 'Note for test setup #8',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
    ]
}

@Injectable()
export class EpicSvtTestTypeConfigsApiClientMock extends EpicSvtTestTypeConfigsApiClient {

    protected data: EpicSvtTestTypeConfig[] = [...getMockEpicSvtTestTypeConfig()]
    protected configBodyData: EpicSvtTestTypeConfigBody[] = this.data
        .map(({ id }) => ({ id, configBody: JSON.stringify({ key1: 'value1' }) }))

    override fetchList(queryFilter: { ids?: number[]; testTypeId?: number } = {}): Observable<EpicSvtTestTypeConfig[]> {
        return of(this.data
            .filter(item =>
                (!queryFilter.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter.testTypeId || queryFilter.testTypeId === item.testTypeId),
            ))
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicSvtTestTypeConfigCreate): Observable<EpicSvtTestTypeConfig> {
        const id = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
        const entity: EpicSvtTestTypeConfig = {
            id,
            ...omit(payload, 'configBody'),
            createdAt: moment().toISOString(),
        }

        this.configBodyData.push({
            id,
            configBody: payload.configBody,
        })

        this.data = [...this.data, entity]
        return of(entity)
            .pipe(
                delay(500),
            )
    }

    override fetchOne(entityId: number): Observable<EpicSvtTestTypeConfig> {
        const entity = this.data.find(item => item.id === entityId)
        if (!entity) {
            return throwError(() => new Error(`Entity with id ${entityId} not found`))
        }
        return of(entity)
            .pipe(
                delay(500),
            )
    }

    override fetchConfigBody(id: number): Observable<EpicSvtTestTypeConfigBody> {
        return of(this.configBodyData.find(item => item.id === id)!)
            .pipe(
                delay(500),
            )
    }

}

