import { Injectable } from '@angular/core'
import { EpicAsicTest, EpicAsicTestListQuery, EpicAsicTestsApiClient, EpicAsicTestStatus, EpicWaferTest } from 'epic-ui/api'
import moment from 'moment'
import { Observable } from 'rxjs'

import { getMockEpicWaferTestsList } from './epic-wafer-tests.api-client.mock'

import QueryFilter = EpicAsicTestListQuery.QueryFilter


export function getMockEpicAsicTestsList(): EpicAsicTest[] {
    return [
        {
            id: 1,
            asicId: 1,
            waferTestId: 1,
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: moment('2025-01-01 10:00:00').toISOString(),
            finishedAt: moment('2025-01-01 10:01:00').toISOString(),
            status: EpicAsicTestStatus.Done,
        },
        {
            id: 2,
            asicId: 2,
            waferTestId: 1,
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: moment('2025-01-01 10:01:00').toISOString(),
            finishedAt: moment('2025-01-01 10:02:00').toISOString(),
            status: EpicAsicTestStatus.Error,
        },
        {
            id: 3,
            asicId: 3,
            waferTestId: 1,
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: moment('2025-01-01 10:02:00').toISOString(),
            finishedAt: moment('2025-01-01 10:03:00').toISOString(),
            status: EpicAsicTestStatus.Done,
        },
        {
            id: 4,
            asicId: 3,
            waferTestId: 1,
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: moment('2025-01-01 10:02:00').toISOString(),
            finishedAt: null,
            status: EpicAsicTestStatus.Processing,
        },
        {
            id: 5,
            asicId: 3,
            waferTestId: 1,
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: null,
            finishedAt: null,
            status: EpicAsicTestStatus.None,
        },
        {
            id: 6,
            asicId: 3,
            waferTestId: 1,
            createdAt: moment('2025-01-01 10:00:00').toISOString(),
            startedAt: null,
            finishedAt: null,
            status: EpicAsicTestStatus.None,
        },
    ]
}

@Injectable()
export class EpicAsicTestsApiClientMock extends EpicAsicTestsApiClient {

    protected data: EpicWaferTest[] = getMockEpicWaferTestsList()

    override fetchAll(queryFilter: QueryFilter): Observable<EpicAsicTest[]> {
        return super.fetchAll(queryFilter)
    }

}

