import { Injectable } from '@nestjs/common'
import { EpicSvtTestSetupConfigBodyEntity, EpicSvtTestSetupConfigCreateEntity, EpicSvtTestSetupConfigEntity } from 'epic/entities'
import { omit } from 'lodash-es'
import moment from 'moment/moment'
import { delay, map, Observable, of } from 'rxjs'


@Injectable()
export class EpicDbAgentSvtTestSetupConfigsService {

    protected data: EpicSvtTestSetupConfigEntity[] = [
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
            name: 'Test setup #2 :: Config #2',
            note: 'Note for test setup #2',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 3,
            setupId: 3,
            name: 'Test setup #3 :: Config #2',
            note: 'Note for test setup #3',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 4,
            setupId: 4,
            name: 'Test setup #4 :: Config #3',
            note: 'Note for test setup #4',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 5,
            setupId: 1,
            name: 'Test setup #5 :: Config #4',
            note: 'Note for test setup #5',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 6,
            setupId: 2,
            name: 'Test setup #6 :: Config #2',
            note: 'Note for test setup #6',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 7,
            setupId: 3,
            name: 'Test setup #7 :: Config #2',
            note: 'Note for test setup #7',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
        {
            id: 8,
            setupId: 4,
            name: 'Test setup #8 :: Config #3',
            note: 'Note for test setup #8',
            createdAt: moment().subtract('2', 'day').toISOString(),
        },
    ]

    protected configBodyData: EpicSvtTestSetupConfigBodyEntity[] = this.data
        .map(({ id }) => ({ id, configBody: JSON.stringify({ key1: 'value1' }) }))

    getAll(queryFilter?: { ids?: number[]; setupId?: number }): Observable<EpicSvtTestSetupConfigEntity[]> {
        const result = this.data
            .filter(item =>
                (!queryFilter?.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter?.setupId || queryFilter.setupId === item.setupId),
            )

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicSvtTestSetupConfigEntity | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    getConfigBody(entityId: number): Observable<EpicSvtTestSetupConfigBodyEntity | undefined> {
        return of(this.configBodyData.find(item => item.id === entityId))
            .pipe(
                delay(50),
            )
    }

    create(createRequest: EpicSvtTestSetupConfigCreateEntity): Observable<EpicSvtTestSetupConfigEntity> {
        const id = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
        const newSvtTestSetup: EpicSvtTestSetupConfigEntity = {
            id,
            ...omit(createRequest, 'configBody'),
            createdAt: moment().toISOString(),
        }

        this.configBodyData.push({
            id,
            configBody: createRequest.configBody,
        })

        this.data.push(newSvtTestSetup)

        return of(newSvtTestSetup)
            .pipe(
                delay(50),
            )
    }

}
