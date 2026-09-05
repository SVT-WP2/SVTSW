import { EpicSvtTestStatus } from 'epic-ui/api'
import { AgLabelCell } from 'epic-ui/common/ag-grid'
import { toEpicMatOutlinedIcon } from 'epic-ui/common/components'
import { DEFAULT_SYSTEM_COLORS } from 'epic-ui/utils/colors'
import { uniq } from 'lodash-es'
import moment from 'moment'

import { EpicSvtTestsGrid } from './epic-svt-tests-grid.models'


/**
 * One single DUT never carries the amount of tests the global list has to cope with, so its whole list is
 * fetched at once instead of block by block. The page size only decides how many round trips that takes —
 * `fetchAllList` keeps walking until every page is in, so nothing is silently cut off.
 */
export const EPIC_SVT_DUT_TESTS_PAGE_SIZE = 1000

/** What the tests of a single DUT add up to. Everything here is derived, none of it is fetched. */
export type EpicSvtDutTestsStats = {
    totalCount: number
    /** Every status of the enum is a key, the ones nothing fell into with a zero. */
    countByStatus: Record<EpicSvtTestStatus, number>
    /** Tests that have already run, i.e. everything that is neither pending nor running. */
    finishedCount: number
    /** Share of the finished tests that completed, between 0 and 1. `null` while nothing has finished. */
    successRate: number | null
    /** Mean of `finishedAt - startedAt` over the tests carrying both, `null` when there is not a single one. */
    averageDurationInMs: number | null
    /** `createdAt` of the newest test, `null` for an empty list. */
    lastTestCreatedAt: string | null
    /** How many different test types the DUT has been through. */
    testTypesCount: number
}

/** One box of the statistics strip — the strip is data driven so the template stays a single loop. */
export type EpicSvtDutTestsStatTile = {
    id: string
    label: string
    value: string
    /**
     * The same number over the unfiltered list, shown right next to the value. `null` while nothing is filtered
     * out, and for the boxes holding no count at all — a duration has no meaningful denominator.
     */
    totalValue: string | null
    /** Second, quieter line under the value. `null` when there is nothing worth adding. */
    hint: string | null
    icon: string
    color: string
    bgColor: string
}

export function getDefaultEpicSvtDutTestsStats(): EpicSvtDutTestsStats {
    return {
        totalCount: 0,
        countByStatus: toEmptyCountByStatus(),
        finishedCount: 0,
        successRate: null,
        averageDurationInMs: null,
        lastTestCreatedAt: null,
        testTypesCount: 0,
    }
}

export function getEpicSvtDutTestsStats(tests: EpicSvtTestsGrid.RowEntity[]): EpicSvtDutTestsStats {
    if (!tests.length) {
        return getDefaultEpicSvtDutTestsStats()
    }

    const countByStatus = tests.reduce<Record<EpicSvtTestStatus, number>>(
        (acc, item) => ({
            ...acc,
            [item.status]: (acc[item.status] || 0) + 1,
        }),
        toEmptyCountByStatus(),
    )
    const finishedCount = countByStatus[EpicSvtTestStatus.Completed]
        + countByStatus[EpicSvtTestStatus.Failed]
        + countByStatus[EpicSvtTestStatus.Cancelled]
    // a test can only be timed once it has both ends, so a pending or running one does not weigh in
    const durations = tests
        .filter(item => item.startedAt && item.finishedAt)
        .map(item => moment(item.finishedAt).diff(moment(item.startedAt)))

    return {
        totalCount: tests.length,
        countByStatus,
        finishedCount,
        successRate: finishedCount
            ? countByStatus[EpicSvtTestStatus.Completed] / finishedCount
            : null,
        averageDurationInMs: durations.length
            ? durations.reduce((acc, item) => acc + item, 0) / durations.length
            : null,
        lastTestCreatedAt: tests
            .map(item => item.createdAt)
            .filter(item => !!item)
            .reduce<string | null>(
                (acc, item) => !acc || moment(item).isAfter(acc) ? item : acc,
                null,
            ),
        testTypesCount: uniq(
            tests
                .map(item => item.testType?.id)
                .filter(item => item !== undefined),
        ).length,
    }
}

/**
 * `totalStats` are the ones of the unfiltered list. Handing them over is what turns every count into a
 * `12 / 34`, so the caller only passes them while the filter bar actually narrows the list down.
 */
export function toEpicSvtDutTestsStatTiles(
    stats: EpicSvtDutTestsStats, totalStats: EpicSvtDutTestsStats | null = null): EpicSvtDutTestsStatTile[] {

    const pendingCount = stats.countByStatus[EpicSvtTestStatus.Pending]
    const runningCount = stats.countByStatus[EpicSvtTestStatus.Running]

    return [
        {
            id: 'total',
            label: 'Tests',
            value: stats.totalCount.toString(),
            totalValue: totalStats ? totalStats.totalCount.toString() : null,
            hint: stats.testTypesCount
                ? `${stats.testTypesCount} ${stats.testTypesCount === 1 ? 'test type' : 'test types'}`
                : null,
            icon: toEpicMatOutlinedIcon('science'),
            color: DEFAULT_SYSTEM_COLORS.NEUTRAL_900,
            bgColor: DEFAULT_SYSTEM_COLORS.NEUTRAL_30,
        },
        toStatusTile({
            id: 'completed',
            label: 'Completed',
            status: EpicSvtTestStatus.Completed,
            stats,
            totalStats,
            hint: toShareOfFinishedHint(stats.successRate),
            icon: toEpicMatOutlinedIcon('check_circle'),
        }),
        toStatusTile({
            id: 'failed',
            label: 'Failed',
            status: EpicSvtTestStatus.Failed,
            stats,
            totalStats,
            hint: toShareOfFinishedHint(toFailureRate(stats)),
            icon: toEpicMatOutlinedIcon('cancel'),
        }),
        {
            id: 'notFinished',
            label: 'Not Finished',
            value: (pendingCount + runningCount).toString(),
            totalValue: totalStats ? toNotFinishedCount(totalStats).toString() : null,
            hint: `${pendingCount} pending, ${runningCount} running`,
            icon: toEpicMatOutlinedIcon('pending'),
            ...EpicSvtTestsGrid.getStatusLabelConfig(EpicSvtTestStatus.Running),
        },
        {
            id: 'averageDuration',
            label: 'Avg. Duration',
            value: toEpicSvtTestDurationLabel(stats.averageDurationInMs),
            totalValue: null,
            hint: 'per timed test',
            icon: toEpicMatOutlinedIcon('timer'),
            color: DEFAULT_SYSTEM_COLORS.NEUTRAL_900,
            bgColor: DEFAULT_SYSTEM_COLORS.NEUTRAL_30,
        },
        {
            id: 'lastTest',
            label: 'Last Test',
            value: stats.lastTestCreatedAt ? moment(stats.lastTestCreatedAt).fromNow() : '-',
            totalValue: null,
            hint: stats.lastTestCreatedAt
                ? moment(stats.lastTestCreatedAt).format('DD.MM.YY - HH:mm:ss')
                : null,
            icon: toEpicMatOutlinedIcon('history'),
            color: DEFAULT_SYSTEM_COLORS.NEUTRAL_900,
            bgColor: DEFAULT_SYSTEM_COLORS.NEUTRAL_30,
        },
    ]
}

/** Rounded down to the two coarsest units that still say something — an exact millisecond count reads as noise. */
export function toEpicSvtTestDurationLabel(durationInMs: number | null): string {
    if (durationInMs === null) {
        return '-'
    }

    const duration = moment.duration(durationInMs)
    const hours = Math.floor(duration.asHours())
    const minutes = duration.minutes()
    const seconds = duration.seconds()

    if (hours) {
        return `${hours}h ${minutes}m`
    }

    if (minutes) {
        return `${minutes}m ${seconds}s`
    }

    return `${seconds}s`
}

function toEmptyCountByStatus(): Record<EpicSvtTestStatus, number> {
    return Object.values(EpicSvtTestStatus)
        .reduce<Record<EpicSvtTestStatus, number>>(
            (acc, item) => ({ ...acc, [item]: 0 }),
            {} as Record<EpicSvtTestStatus, number>,
        )
}

function toNotFinishedCount(stats: EpicSvtDutTestsStats): number {
    return stats.countByStatus[EpicSvtTestStatus.Pending] + stats.countByStatus[EpicSvtTestStatus.Running]
}

type StatusTileParams = {
    id: string
    label: string
    status: EpicSvtTestStatus
    stats: EpicSvtDutTestsStats
    totalStats: EpicSvtDutTestsStats | null
    hint: string | null
    icon: string
}

/** A status box wears the very same colours the status column of the grid gives that status. */
function toStatusTile(params: StatusTileParams): EpicSvtDutTestsStatTile {
    const labelConfig: AgLabelCell.Config = EpicSvtTestsGrid.getStatusLabelConfig(params.status)

    return {
        id: params.id,
        label: params.label,
        value: params.stats.countByStatus[params.status].toString(),
        totalValue: params.totalStats
            ? params.totalStats.countByStatus[params.status].toString()
            : null,
        hint: params.hint,
        icon: params.icon,
        color: labelConfig.color,
        bgColor: labelConfig.bgColor,
    }
}

function toFailureRate(stats: EpicSvtDutTestsStats): number | null {
    return stats.finishedCount
        ? stats.countByStatus[EpicSvtTestStatus.Failed] / stats.finishedCount
        : null
}

function toShareOfFinishedHint(rate: number | null): string | null {
    return rate === null ? null : `${Math.round(rate * 100)}% of finished`
}
