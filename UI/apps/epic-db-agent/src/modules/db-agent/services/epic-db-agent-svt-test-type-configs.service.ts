import { Injectable } from '@nestjs/common'
import { omit } from 'lodash-es'
import moment from 'moment/moment'
import { delay, map, Observable, of } from 'rxjs'
import {
    EpicSvtTestTypeConfig,
    EpicSvtTestTypeConfigBody,
    EpicSvtTestTypeConfigCreateRequest,
    EpicSvtTestTypeConfigsListQuery,
} from 'svt-ts-types'


@Injectable()
export class EpicDbAgentSvtTestTypeConfigsService {

    protected data: EpicSvtTestTypeConfig[] = [
        {
            id: 1,
            testTypeId: 1,
            name: 'Test type #1 :: Config #1',
            note: 'Note for test type config #1',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 2,
            testTypeId: 2,
            name: 'Test type #2 :: Config #1',
            note: 'Note for test type config #2',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 3,
            testTypeId: 3,
            name: 'Test type #3 :: Config #1',
            note: 'Note for test type config #3',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 4,
            testTypeId: 4,
            name: 'Test type #4 :: Config #1',
            note: 'Note for test type config #4',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 5,
            testTypeId: 1,
            name: 'Test type #1 :: Config #2',
            note: 'Note for test type config #5',
            createdAt: moment().subtract('1', 'day').toISOString(),
        },
        {
            id: 6,
            testTypeId: 2,
            name: 'Test type #2 :: Config #2',
            note: 'Note for test type config #6',
            createdAt: moment().subtract('1', 'day').toISOString(),
        },
    ]

    protected configBodyData: EpicSvtTestTypeConfigBody[] = this.data
        .map(({ id }) => ({ id, configBody: JSON.stringify({ key1: 'value1' }) }))

    getAll(queryFilter?: EpicSvtTestTypeConfigsListQuery): Observable<EpicSvtTestTypeConfig[]> {
        const result = this.data
            .filter(item =>
                (!queryFilter?.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter?.testTypeId || queryFilter.testTypeId === item.testTypeId),
            )

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicSvtTestTypeConfig | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    getConfigBody(entityId: number): Observable<EpicSvtTestTypeConfigBody | undefined> {
        return of(this.configBodyData.find(item => item.id === entityId))
            .pipe(
                delay(50),
            )
    }

    create(createRequest: EpicSvtTestTypeConfigCreateRequest): Observable<EpicSvtTestTypeConfig> {
        const id = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
        const newConfig: EpicSvtTestTypeConfig = {
            id,
            ...omit(createRequest, 'configBody'),
            createdAt: moment().toISOString(),
        }

        this.configBodyData.push({
            id,
            configBody: createRequest.configBody,
        })

        this.data.push(newConfig)

        return of(newConfig)
            .pipe(
                delay(50),
            )
    }

}

