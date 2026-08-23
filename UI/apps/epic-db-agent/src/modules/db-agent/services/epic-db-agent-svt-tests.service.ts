import { Injectable } from '@nestjs/common'
import {
    EpicSvtDutEntityName,
    EpicSvtTestCreateEntity,
    EpicSvtTestEntity,
    EpicSvtTestResultStatus,
    EpicSvtTestsGetAllParams,
} from 'epic/entities'
import { delay, map, Observable, of } from 'rxjs'


@Injectable()
export class EpicDbAgentSvtTestsService {

    protected data: EpicSvtTestEntity[] = [
        {
            id: 1,
            dutEntityName: EpicSvtDutEntityName.Chip,
            dutId: 1,
            testTypeConfigId: 1,
            testSetupConfigId: 1,
            createdAt: '2026-01-01T10:00:00.000Z',
            startedAt: '2026-01-01T10:01:00.000Z',
            finishedAt: '2026-01-01T10:05:00.000Z',
            pathToResult: '/results/test-1',
            testResultStatus: EpicSvtTestResultStatus.Completed,
        },
        {
            id: 2,
            dutEntityName: EpicSvtDutEntityName.Chip,
            dutId: 2,
            testTypeConfigId: 2,
            testSetupConfigId: 1,
            createdAt: '2026-01-02T12:00:00.000Z',
            startedAt: '2026-01-02T12:01:00.000Z',
            finishedAt: '2026-01-02T12:10:00.000Z',
            pathToResult: '/results/test-2',
            testResultStatus: EpicSvtTestResultStatus.Failed,
        },
        {
            id: 3,
            dutEntityName: EpicSvtDutEntityName.Asic,
            dutId: 1,
            testTypeConfigId: 1,
            testSetupConfigId: 2,
            createdAt: '2026-01-03T08:00:00.000Z',
            startedAt: '2026-01-03T08:01:00.000Z',
            finishedAt: '2026-01-03T08:20:00.000Z',
            pathToResult: '/results/test-3',
            testResultStatus: EpicSvtTestResultStatus.Completed,
        },
    ]

    getAll(queryFilter?: EpicSvtTestsGetAllParams): Observable<EpicSvtTestEntity[]> {
        const result = this.data
            .filter(item =>
                (!queryFilter?.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter?.dutEntityNames || queryFilter.dutEntityNames.includes(item.dutEntityName)),
            )

        return of(result)
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicSvtTestEntity | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(list => list[0]),
            )
    }

    create(createRequest: EpicSvtTestCreateEntity): Observable<EpicSvtTestEntity> {
        const newId = (this.data[this.data.length - 1]?.id || 0) + 1
        const now = new Date().toISOString()

        const newEntity: EpicSvtTestEntity = {
            id: newId,
            dutEntityName: createRequest.dutEntityName,
            dutId: createRequest.dutId,
            testTypeConfigId: createRequest.testTypeConfigId,
            testSetupConfigId: createRequest.testSetupConfigId,
            createdAt: now,
            startedAt: '',
            finishedAt: '',
            pathToResult: '',
            testResultStatus: EpicSvtTestResultStatus.None,
        }

        this.data.push(newEntity)

        return of(newEntity)
            .pipe(
                delay(50),
            )
    }

}

