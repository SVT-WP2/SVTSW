/**
 * Query string of `GET /api/svt-test-type-configs` — an omitted / `null` / empty member does not narrow the list
 * down.
 */
export type EpicSvtTestTypeConfigsListQuery = {
    ids?: number[] | null
    testTypeId?: number | null
}
