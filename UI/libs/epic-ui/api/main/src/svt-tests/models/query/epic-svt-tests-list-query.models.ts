export namespace EpicSvtTestsListQuery {

    /**
     * Mirrors the SvtTests list filter of the API. Date bounds are ISO date-time strings — `*From` is
     * inclusive, `*To` is exclusive.
     */
    export type QueryFilter = {
        /** Kept as typed by the user — the API is the one deciding what is a valid id, see the search box. */
        ids?: (number | string)[] | null
        dutEntityNames?: string[] | null
        /** DUT ids are unique per DUT entity only, so it is meant to be combined with `dutEntityNames`. */
        dutId?: number | null
        /** Enum values of `EpicSvtTestStatus` — the same status the list shows, resolved by the API. */
        statuses?: string[] | null
        testTypeConfigIds?: number[] | null
        testSetupConfigIds?: number[] | null
        createdAtFrom?: string | null
        createdAtTo?: string | null
        startedAtFrom?: string | null
        startedAtTo?: string | null
        finishedAtFrom?: string | null
        finishedAtTo?: string | null
    }

}
