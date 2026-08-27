import { Injectable } from '@nestjs/common'
import {
    EpicPageData,
    EpicPager,
    EpicSvtDutEntityName,
    EpicSvtTestCreateEntity,
    EpicSvtTestEntity,
    EpicSvtTestResultStatus,
    SvtDbAgentKafkaSvtTests,
} from 'epic/entities'
import { delay, map, Observable, of } from 'rxjs'


/** How many of the newest generated tests have not been run yet. */
const PENDING_TESTS_COUNT = 3

@Injectable()
export class EpicDbAgentSvtTestsService {

    protected data: EpicSvtTestEntity[] = generateSvtTests(2 * 1000)

    getAll(queryFilter?: SvtDbAgentKafkaSvtTests.GetAllSvtTestsFilter, pager?: EpicPager): Observable<EpicPageData<EpicSvtTestEntity>> {
        const filteredData = queryFilter
            ? this.data.filter(item => fulfilsFilter(item, queryFilter))
            : [...this.data]

        // newest first — ordering belongs to the query, so it is applied here rather than baked into the data
        filteredData.sort((left, right) => right.id - left.id)

        const pageData = pager
            ? filteredData.slice(pager.offset, pager.offset + pager.limit)
            : filteredData

        return of({
            items: pageData,
            totalCount: filteredData.length,
        })
            .pipe(
                delay(50),
            )
    }

    getOneById(entityId: number): Observable<EpicSvtTestEntity | undefined> {
        return this.getAll({ ids: [entityId] })
            .pipe(
                map(pageData => pageData.items[0]),
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

/**
 * The date range bounds mirror the Kafka contract: `*From` is inclusive, `*To` is exclusive. An entity whose
 * date is empty (not started / not finished yet) never fulfils a range bound on that date.
 */
function fulfilsDateRange(value: string, from?: string, to?: string): boolean {
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

function fulfilsFilter(item: EpicSvtTestEntity, queryFilter: SvtDbAgentKafkaSvtTests.GetAllSvtTestsFilter): boolean {
    // ids reach the agent as the user typed them, so they are compared as text, the way a DB would coerce them
    const fulfilIdsFilter = !queryFilter.ids?.length
        || queryFilter.ids.map(String).includes(String(item.id))
    const fulfilDutEntityNamesFilter = !queryFilter.dutEntityNames?.length
        || queryFilter.dutEntityNames.includes(item.dutEntityName)
    const fulfilDutIdFilter = !queryFilter.dutId || queryFilter.dutId === item.dutId
    const fulfilTestResultStatusesFilter = !queryFilter.testResultStatuses?.length
        || queryFilter.testResultStatuses.includes(item.testResultStatus)
    const fulfilTestTypeConfigIdsFilter = !queryFilter.testTypeConfigIds?.length
        || queryFilter.testTypeConfigIds.includes(item.testTypeConfigId)
    const fulfilTestSetupConfigIdsFilter = !queryFilter.testSetupConfigIds?.length
        || queryFilter.testSetupConfigIds.includes(item.testSetupConfigId)

    return fulfilIdsFilter
        && fulfilDutEntityNamesFilter
        && fulfilDutIdFilter
        && fulfilTestResultStatusesFilter
        && fulfilTestTypeConfigIdsFilter
        && fulfilTestSetupConfigIdsFilter
        && fulfilsDateRange(item.createdAt, queryFilter.createdAtFrom, queryFilter.createdAtTo)
        && fulfilsDateRange(item.startedAt, queryFilter.startedAtFrom, queryFilter.startedAtTo)
        && fulfilsDateRange(item.finishedAt, queryFilter.finishedAtFrom, queryFilter.finishedAtTo)
}

export function generateSvtTests(totalCount: number, idStartsFrom = 1): EpicSvtTestEntity[] {
    const dutEntityNames = Object.values(EpicSvtDutEntityName)
    // a test that has already run always ends up with one of the final result statuses
    const finalResultStatuses = [
        EpicSvtTestResultStatus.Completed,
        EpicSvtTestResultStatus.Failed,
        EpicSvtTestResultStatus.Cancelled,
    ]
    // fixed base timestamp — the generated list stays stable between restarts
    const baseTime = new Date('2026-01-01T00:00:00.000Z').getTime()
    const result: EpicSvtTestEntity[] = []
    // the list is ordered newest first, so only the newest tests are still waiting to be run
    const firstPendingId = idStartsFrom + totalCount - (PENDING_TESTS_COUNT - 1)

    for (let i = idStartsFrom; i <= idStartsFrom + totalCount; i++) {
        // a test with no result yet has not been started nor finished
        const isPending = i >= firstPendingId
        const testResultStatus = isPending
            ? EpicSvtTestResultStatus.None
            : finalResultStatuses[i % finalResultStatuses.length]
        const createdAt = new Date(baseTime + i * 60 * 60 * 1000).toISOString()
        const startedAt = isPending ? '' : new Date(baseTime + i * 60 * 60 * 1000 + 60 * 1000).toISOString()
        const finishedAt = isPending ? '' : new Date(baseTime + i * 60 * 60 * 1000 + 10 * 60 * 1000).toISOString()

        result.push({
            id: i,
            dutEntityName: dutEntityNames[i % dutEntityNames.length],
            dutId: Math.ceil(i / dutEntityNames.length),
            testTypeConfigId: (i % 2) + 1,
            testSetupConfigId: (i % 3) + 1,
            createdAt,
            startedAt,
            finishedAt,
            pathToResult: isPending ? '' : `/results/test-${i}`,
            testResultStatus,
        })
    }

    return result
}
