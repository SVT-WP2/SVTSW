import { Injectable } from '@angular/core'
import {
    EpicSvtTestSetupConfig,
    EpicSvtTestSetupConfigBody,
    EpicSvtTestSetupConfigCreate,
    EpicSvtTestSetupConfigsApiClient,
} from 'epic-ui/api'
import { omit } from 'lodash-es'
import moment from 'moment'
import { delay, Observable, of } from 'rxjs'


export function getMockEpicSvtTestSetupConfig(): EpicSvtTestSetupConfig[] {
    return [
        {
            id: 1,
            setupId: 1,
            name: 'Test setup #1 :: Config #1',
            note: 'Note for test setup #1',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 2,
            setupId: 2,
            name: 'Test setup #2 :: Config #1',
            note: 'Note for test setup #2',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 3,
            setupId: 3,
            name: 'Test setup #3 :: Config #1',
            note: 'Note for test setup #3',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 4,
            setupId: 4,
            name: 'Test setup #4 :: Config #1',
            note: 'Note for test setup #4',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 5,
            setupId: 1,
            name: 'Test setup #1 :: Config #2',
            note: 'Note for test setup #5',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 6,
            setupId: 2,
            name: 'Test setup #2 :: Config #2',
            note: 'Note for test setup #6',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 7,
            setupId: 3,
            name: 'Test setup #3 :: Config #2',
            note: 'Note for test setup #7',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 8,
            setupId: 4,
            name: 'Test setup #4 :: Config #2',
            note: 'Note for test setup #8',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
    ]
}

@Injectable()
export class EpicSvtTestSetupConfigsApiClientMock extends EpicSvtTestSetupConfigsApiClient {

    protected data: EpicSvtTestSetupConfig[] = [...getMockEpicSvtTestSetupConfig()]
    protected configBodyData: EpicSvtTestSetupConfigBody[] = this.data
        .map(({ id }) => ({ id, configBody: JSON.stringify({ key1: 'value1' }) }))

    override fetchList(queryFilter: { ids?: number[]; setupId?: number } = {}): Observable<EpicSvtTestSetupConfig[]> {
        return of(this.data
            .filter(item =>
                (!queryFilter.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter.setupId || queryFilter.setupId === item.setupId),
            ))
            .pipe(
                delay(500),
            )
    }

    override create(payload: EpicSvtTestSetupConfigCreate): Observable<EpicSvtTestSetupConfig> {
        const id = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
        const entity: EpicSvtTestSetupConfig = {
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

    override fetchConfigBody(id: number): Observable<EpicSvtTestSetupConfigBody> {
        return of(this.configBodyData.find(item => item.id === id)!)
            .pipe(
                delay(500),
            )
    }

}

