import { EpicSvtDutEntityName, EpicSvtTestsListQuery, EpicSvtTestStatus } from 'epic-ui/api'
import { EpicInlineFilterDateRange } from 'epic-ui/common/components'
import { SelectOptionLabelValue } from 'epic-ui/utils'
import { uniq } from 'lodash-es'


export type EpicSvtTestsListFilterValue = {
    /** Free text of the search box — it is read as a list of test ids. */
    searchTerm: string
    dutEntityNames: string[] | null
    statuses: string[] | null
    testTypeIds: number[] | null
    testTypeConfigIds: number[] | null
    testSetupIds: number[] | null
    testSetupConfigIds: number[] | null
    createdAt: EpicInlineFilterDateRange.Value | null
    startedAt: EpicInlineFilterDateRange.Value | null
    finishedAt: EpicInlineFilterDateRange.Value | null
}

/** Options the filter bar cannot derive from an enum — they are fetched, see `EpicSvtTestsListFilterDataSource`. */
export type EpicSvtTestsListFilterData = {
    testTypeSelectOptions: SelectOptionLabelValue<number>[]
    testTypeConfigSelectOptions: SelectOptionLabelValue<number>[]
    testSetupSelectOptions: SelectOptionLabelValue<number>[]
    testSetupConfigSelectOptions: SelectOptionLabelValue<number>[]
    /** Which configs belong to which test type — the API has no filter by test type, see the mapping below. */
    testTypeConfigIdsByTestTypeId: Record<number, number[]>
    /** Same for the test setups, which the API cannot filter by either. */
    testSetupConfigIdsByTestSetupId: Record<number, number[]>
}

export function getDefaultEpicSvtTestsListFilterValue(): EpicSvtTestsListFilterValue {
    return {
        searchTerm: '',
        dutEntityNames: null,
        statuses: null,
        testTypeIds: null,
        testTypeConfigIds: null,
        testSetupIds: null,
        testSetupConfigIds: null,
        createdAt: null,
        startedAt: null,
        finishedAt: null,
    }
}

export function isEpicSvtTestsListFilterValueEmpty(filterValue: EpicSvtTestsListFilterValue): boolean {
    return !filterValue.searchTerm
        && !filterValue.dutEntityNames?.length
        && !filterValue.statuses?.length
        && !filterValue.testTypeIds?.length
        && !filterValue.testTypeConfigIds?.length
        && !filterValue.testSetupIds?.length
        && !filterValue.testSetupConfigIds?.length
        && EpicInlineFilterDateRange.isEmpty(filterValue.createdAt)
        && EpicInlineFilterDateRange.isEmpty(filterValue.startedAt)
        && EpicInlineFilterDateRange.isEmpty(filterValue.finishedAt)
}

export function getEpicSvtTestDutEntityNameSelectOptions(): SelectOptionLabelValue[] {
    return Object.values(EpicSvtDutEntityName)
        .map(item => ({ value: item, label: item }))
}

export function getEpicSvtTestStatusSelectOptions(): SelectOptionLabelValue[] {
    return Object.values(EpicSvtTestStatus)
        .map(item => ({ value: item, label: item }))
}

/**
 * The search box narrows the list down by test id. What was typed is passed on as it is — only trimmed, and
 * split on commas so several ids can be entered at once. Nothing is validated or dropped here on purpose: a
 * term that is not an id is answered by the API with an empty list, instead of quietly filtering by nothing.
 */
export function toEpicSvtTestIdsFilter(searchTerm: string): string[] | undefined {
    const ids = (searchTerm || '')
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length)

    return ids.length ? ids : undefined
}

/**
 * Config ids belonging to the selected owners (test types or test setups), or `null` when nothing narrows them
 * down. It both limits the options offered by the config filter and expresses the owner filter towards the API.
 */
export function getEpicSvtTestConfigIdsOfOwners(
    ownerIds: number[] | null, configIdsByOwnerId?: Record<number, number[]>): number[] | null {

    if (!ownerIds?.length) {
        return null
    }

    return uniq(
        ownerIds.flatMap(ownerId => configIdsByOwnerId?.[ownerId] || []),
    )
}

export function getEpicSvtTestConfigIdsOfTestTypes(
    testTypeIds: number[] | null, filterData?: EpicSvtTestsListFilterData | null): number[] | null {

    return getEpicSvtTestConfigIdsOfOwners(testTypeIds, filterData?.testTypeConfigIdsByTestTypeId)
}

export function getEpicSvtTestConfigIdsOfTestSetups(
    testSetupIds: number[] | null, filterData?: EpicSvtTestsListFilterData | null): number[] | null {

    return getEpicSvtTestConfigIdsOfOwners(testSetupIds, filterData?.testSetupConfigIdsByTestSetupId)
}

/** Narrows an explicit config selection down by the configs of the selected owner, see the two callers below. */
export function toEpicSvtTestConfigIdsIntersection(
    selectedConfigIds: number[] | null, configIdsOfOwners: number[] | null): number[] | null {

    if (!configIdsOfOwners) {
        return selectedConfigIds?.length ? selectedConfigIds : null
    }

    return selectedConfigIds?.length
        ? configIdsOfOwners.filter(item => selectedConfigIds.includes(item))
        : configIdsOfOwners
}

/**
 * The API has no filter by test type, so a test type is expressed through the configs that belong to it. With
 * both filters set only the configs satisfying both narrow the list down, and an empty result is kept as an
 * empty list on purpose: it means "nothing can match", which the data source turns into an empty page. The
 * filter bar keeps the two selections in sync, so that only happens to a filter value restored from elsewhere.
 */
export function toEpicSvtTestTypeConfigIdsFilter(
    filterValue: EpicSvtTestsListFilterValue, filterData?: EpicSvtTestsListFilterData | null): number[] | null {

    return toEpicSvtTestConfigIdsIntersection(
        filterValue.testTypeConfigIds,
        getEpicSvtTestConfigIdsOfTestTypes(filterValue.testTypeIds, filterData),
    )
}

export function toEpicSvtTestSetupConfigIdsFilter(
    filterValue: EpicSvtTestsListFilterValue, filterData?: EpicSvtTestsListFilterData | null): number[] | null {

    return toEpicSvtTestConfigIdsIntersection(
        filterValue.testSetupConfigIds,
        getEpicSvtTestConfigIdsOfTestSetups(filterValue.testSetupIds, filterData),
    )
}

/**
 * Maps the header filter onto the query the API understands. The date bounds the user picked are inclusive on
 * both ends, while the API takes an exclusive upper bound — `EpicInlineFilterDateRange` does that shift.
 */
export function toEpicSvtTestsListQueryFilter(
    filterValue: EpicSvtTestsListFilterValue,
    filterData?: EpicSvtTestsListFilterData | null): EpicSvtTestsListQuery.QueryFilter {

    return {
        ids: toEpicSvtTestIdsFilter(filterValue.searchTerm),
        dutEntityNames: filterValue.dutEntityNames?.length ? filterValue.dutEntityNames : null,
        statuses: filterValue.statuses?.length ? filterValue.statuses : null,
        testTypeConfigIds: toEpicSvtTestTypeConfigIdsFilter(filterValue, filterData),
        testSetupConfigIds: toEpicSvtTestSetupConfigIdsFilter(filterValue, filterData),
        createdAtFrom: EpicInlineFilterDateRange.toInclusiveFrom(filterValue.createdAt),
        createdAtTo: EpicInlineFilterDateRange.toExclusiveTo(filterValue.createdAt),
        startedAtFrom: EpicInlineFilterDateRange.toInclusiveFrom(filterValue.startedAt),
        startedAtTo: EpicInlineFilterDateRange.toExclusiveTo(filterValue.startedAt),
        finishedAtFrom: EpicInlineFilterDateRange.toInclusiveFrom(filterValue.finishedAt),
        finishedAtTo: EpicInlineFilterDateRange.toExclusiveTo(filterValue.finishedAt),
    }
}
