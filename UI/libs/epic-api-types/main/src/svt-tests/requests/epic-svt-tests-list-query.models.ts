import { EpicDateTimeString } from '../../common'


/**
 * Filter part of the `GET /api/svt-tests` query string; the paging part is `EpicApiPager`. Every member is
 * optional — an omitted / `null` / empty one means "do not narrow the list down by it".
 *
 * It is deliberately *not* the Kafka filter: the API speaks in the synthetic `status` the UI shows, and
 * translates it into the physical `testResultStatus` values the DB agent stores.
 */
export type EpicSvtTestsListQuery = {
    /** Test ids. The UI's search box feeds this one — a token that is no integer never leaves the UI. */
    ids?: number[] | null
    /** Enum values of `EpicSvtDutEntityName`. */
    dutEntityNames?: string[] | null
    /** DUT ids are unique per DUT entity only, so it is meant to be combined with `dutEntityNames`. */
    dutId?: number | null
    /** Enum values of `EpicSvtTestStatus` — the status the UI shows, not the stored result status. */
    statuses?: string[] | null
    testTypeConfigIds?: number[] | null
    testSetupConfigIds?: number[] | null
    /** Lower bound of the `createdAt` range, inclusive. */
    createdAtFrom?: EpicDateTimeString | null
    /** Upper bound of the `createdAt` range, exclusive. */
    createdAtTo?: EpicDateTimeString | null
    /** Lower bound of the `startedAt` range, inclusive. */
    startedAtFrom?: EpicDateTimeString | null
    /** Upper bound of the `startedAt` range, exclusive. */
    startedAtTo?: EpicDateTimeString | null
    /** Lower bound of the `finishedAt` range, inclusive. */
    finishedAtFrom?: EpicDateTimeString | null
    /** Upper bound of the `finishedAt` range, exclusive. */
    finishedAtTo?: EpicDateTimeString | null
}
