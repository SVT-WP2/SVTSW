import { Injectable } from '@angular/core'
import {
    EpicSvtDutEntityName,
    EpicSvtTest,
    EpicSvtTestCreate,
    EpicSvtTestResultStatus,
    EpicSvtTestsApiClient,
    EpicSvtTestsListQuery,
    EpicSvtTestStatus,
} from 'epic-ui/api'
import moment from 'moment'
import { delay, Observable, of, throwError } from 'rxjs'


export function getMockEpicSvtTests(): EpicSvtTest[] {
    return [
        {
            id: 1,
            dutEntityName: EpicSvtDutEntityName.Chip,
            dutId: 1,
            testTypeConfigId: 1,
            testSetupConfigId: 1,
            createdAt: moment().subtract(3, 'day').toISOString(),
            startedAt: moment().subtract(3, 'day').add(1, 'minute').toISOString(),
            finishedAt: moment().subtract(3, 'day').add(5, 'minute').toISOString(),
            pathToResult: '/results/test-1',
            testResultStatus: EpicSvtTestResultStatus.Completed,
            status: EpicSvtTestStatus.Completed,
        },
        {
            id: 2,
            dutEntityName: EpicSvtDutEntityName.Chip,
            dutId: 2,
            testTypeConfigId: 2,
            testSetupConfigId: 1,
            createdAt: moment().subtract(2, 'day').toISOString(),
            startedAt: moment().subtract(2, 'day').add(1, 'minute').toISOString(),
            finishedAt: moment().subtract(2, 'day').add(10, 'minute').toISOString(),
            pathToResult: '/results/test-2',
            testResultStatus: EpicSvtTestResultStatus.Failed,
            status: EpicSvtTestStatus.Failed,
        },
        {
            id: 3,
            dutEntityName: EpicSvtDutEntityName.Asic,
            dutId: 1,
            testTypeConfigId: 1,
            testSetupConfigId: 2,
            createdAt: moment().subtract(1, 'day').toISOString(),
            startedAt: moment().subtract(1, 'day').add(1, 'minute').toISOString(),
            finishedAt: moment().subtract(1, 'day').add(20, 'minute').toISOString(),
            pathToResult: '/results/test-3',
            testResultStatus: EpicSvtTestResultStatus.Completed,
            status: EpicSvtTestStatus.Completed,
        },
        {
            id: 4,
            dutEntityName: EpicSvtDutEntityName.ChipBlock,
            dutId: 3,
            testTypeConfigId: 2,
            testSetupConfigId: 2,
            createdAt: moment().subtract(1, 'hour').toISOString(),
            startedAt: '',
            finishedAt: '',
            pathToResult: '',
            testResultStatus: EpicSvtTestResultStatus.None,
            status: EpicSvtTestStatus.Running,
        },
        {
            id: 5,
            dutEntityName: EpicSvtDutEntityName.ChipBlock,
            dutId: 3,
            testTypeConfigId: 2,
            testSetupConfigId: 2,
            createdAt: moment().subtract(1, 'hour').toISOString(),
            startedAt: '',
            finishedAt: '',
            pathToResult: '',
            testResultStatus: EpicSvtTestResultStatus.None,
            status: EpicSvtTestStatus.Pending,
        },
    ]
}

@Injectable()
export class EpicSvtTestsApiClientMock extends EpicSvtTestsApiClient {

    protected data: EpicSvtTest[] = [...getMockEpicSvtTests()]

    override fetchList(queryFilter: EpicSvtTestsListQuery.QueryFilter = {}): Observable<EpicSvtTest[]> {
        return of(this.data
            .filter(item =>
                (!queryFilter.ids || queryFilter.ids.includes(item.id))
                && (!queryFilter.dutEntityNames || queryFilter.dutEntityNames.includes(item.dutEntityName)),
            ))
            .pipe(
                delay(500),
            )
    }

    override fetchOne(entityId: number): Observable<EpicSvtTest> {
        const entity = this.data.find(item => item.id === entityId)
        if (!entity) {
            return throwError(() => new Error(`Entity with id ${entityId} not found`))
        }
        return of(entity).pipe(delay(300))
    }

    override create(payload: EpicSvtTestCreate): Observable<EpicSvtTest> {
        const id = this.data.length ? this.data[this.data.length - 1].id + 1 : 1
        const entity: EpicSvtTest = {
            id,
            ...payload,
            createdAt: moment().toISOString(),
            startedAt: '',
            finishedAt: '',
            pathToResult: '',
            testResultStatus: EpicSvtTestResultStatus.None,
            status: EpicSvtTestStatus.Pending,
        }

        this.data = [...this.data, entity]

        return of(entity)
            .pipe(
                delay(500),
            )
    }

}
