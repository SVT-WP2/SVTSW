import { Injectable } from '@angular/core'
import {
    EpicApiPager,
    EpicApiPageResponse,
    EpicSvtDutEntityName,
    EpicSvtTest,
    EpicSvtTestCreate,
    EpicSvtTestResultStatus,
    EpicSvtTestsApiClient,
    EpicSvtTestsListQuery,
    EpicSvtTestStatus,
    getDefaultEpicApiPager,
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

/** How many of the newest generated tests have not been run yet. */
const PENDING_TESTS_COUNT = 3

/**
 * Bulk data standing behind the curated entries — the paginated list and its filters only make sense over a
 * data set that is bigger than a single page.
 */
export function generateMockEpicSvtTests(totalCount: number, idStartsFrom = 1): EpicSvtTest[] {
    const dutEntityNames = Object.values(EpicSvtDutEntityName)
    // a test that has already run always ends up with one of the final result statuses
    const finalResultStatuses = [
        EpicSvtTestResultStatus.Completed,
        EpicSvtTestResultStatus.Failed,
        EpicSvtTestResultStatus.Cancelled,
    ]
    const result: EpicSvtTest[] = []
    // the list is ordered newest first, so only the newest tests are still waiting to be run
    const firstPendingId = idStartsFrom + totalCount - PENDING_TESTS_COUNT

    for (let i = idStartsFrom; i < idStartsFrom + totalCount; i++) {
        // a test with no result yet has neither been started nor finished
        const isPending = i >= firstPendingId
        const testResultStatus = isPending
            ? EpicSvtTestResultStatus.None
            : finalResultStatuses[i % finalResultStatuses.length]
        const createdAt = moment().subtract(i, 'hour')

        result.push({
            id: i,
            dutEntityName: dutEntityNames[i % dutEntityNames.length],
            dutId: Math.ceil(i / dutEntityNames.length),
            testTypeConfigId: (i % 2) + 1,
            testSetupConfigId: (i % 3) + 1,
            createdAt: createdAt.toISOString(),
            startedAt: isPending ? '' : createdAt.clone().add(1, 'minute').toISOString(),
            finishedAt: isPending ? '' : createdAt.clone().add(10, 'minute').toISOString(),
            pathToResult: isPending ? '' : `/results/test-${i}`,
            testResultStatus,
            status: resolveTestStatus(testResultStatus),
        })
    }

    return result
}

@Injectable()
export class EpicSvtTestsApiClientMock extends EpicSvtTestsApiClient {

    protected data: EpicSvtTest[] = [
        ...getMockEpicSvtTests(),
        ...generateMockEpicSvtTests(2 * 1000, 6),
    ]

    override fetchList(
        queryFilter?: Partial<EpicSvtTestsListQuery.QueryFilter>,
        pager?: Partial<EpicApiPager>): Observable<EpicApiPageResponse<EpicSvtTest>> {

        const filteredData = queryFilter
            ? this.data.filter(item => fulfilsFilter(item, queryFilter))
            : [...this.data]

        // newest first — ordering belongs to the query, so it is applied here rather than baked into the data
        filteredData.sort((left, right) => right.id - left.id)

        const pagerDto = { ...getDefaultEpicApiPager(), ...(pager || {}) }
        const pageData = filteredData.slice(pagerDto.offset, pagerDto.offset + pagerDto.limit)

        return of({
            items: pageData,
            totalCount: filteredData.length,
        })
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

/**
 * Mirrors the `status` resolution the BFF does — a test never reaches the UI without the synthetic status.
 */
function resolveTestStatus(testResultStatus: EpicSvtTestResultStatus): EpicSvtTestStatus {
    switch (testResultStatus) {
        case EpicSvtTestResultStatus.None:
            return EpicSvtTestStatus.Pending
        case EpicSvtTestResultStatus.Completed:
            return EpicSvtTestStatus.Completed
        case EpicSvtTestResultStatus.Failed:
            return EpicSvtTestStatus.Failed
        case EpicSvtTestResultStatus.Cancelled:
            return EpicSvtTestStatus.Cancelled
    }
}

/**
 * The date range bounds mirror the Kafka contract: `*From` is inclusive, `*To` is exclusive. An entity whose
 * date is empty (not started / not finished yet) never fulfils a range bound on that date.
 */
function fulfilsDateRange(value: string, from?: string | null, to?: string | null): boolean {
    if (!from && !to) {
        return true
    }

    if (!value) {
        return false
    }

    const timestamp = new Date(value).getTime()

    return (!from || timestamp >= new Date(from).getTime())
        && (!to || timestamp < new Date(to).getTime())
}

function fulfilsFilter(item: EpicSvtTest, queryFilter: Partial<EpicSvtTestsListQuery.QueryFilter>): boolean {
    // ids arrive as the user typed them, so they are compared as text — a term that is not an id matches nothing
    const fulfilIdsFilter = !queryFilter.ids?.length
        || queryFilter.ids.map(String).includes(String(item.id))
    const fulfilDutEntityNamesFilter = !queryFilter.dutEntityNames?.length
        || queryFilter.dutEntityNames.includes(item.dutEntityName)
    const fulfilDutIdFilter = !queryFilter.dutId || queryFilter.dutId === item.dutId
    // the API filters by the synthetic status, so the mock does the same — it stands in for the resolved list
    const fulfilStatusesFilter = !queryFilter.statuses?.length
        || queryFilter.statuses.includes(item.status)
    const fulfilTestTypeConfigIdsFilter = !queryFilter.testTypeConfigIds?.length
        || queryFilter.testTypeConfigIds.includes(item.testTypeConfigId)
    const fulfilTestSetupConfigIdsFilter = !queryFilter.testSetupConfigIds?.length
        || queryFilter.testSetupConfigIds.includes(item.testSetupConfigId)

    return fulfilIdsFilter
        && fulfilDutEntityNamesFilter
        && fulfilDutIdFilter
        && fulfilStatusesFilter
        && fulfilTestTypeConfigIdsFilter
        && fulfilTestSetupConfigIdsFilter
        && fulfilsDateRange(item.createdAt, queryFilter.createdAtFrom, queryFilter.createdAtTo)
        && fulfilsDateRange(item.startedAt, queryFilter.startedAtFrom, queryFilter.startedAtTo)
        && fulfilsDateRange(item.finishedAt, queryFilter.finishedAtFrom, queryFilter.finishedAtTo)
}
