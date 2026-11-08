/**
 * Query string of `GET /api/svt-test-types` — an omitted / `null` / empty member does not narrow the list down.
 */
export type EpicSvtTestTypesListQuery = {
    ids?: number[] | null
    /** Enum values of `dutType`; a test type matches when it supports any of them. */
    dutTypes?: string[] | null
}
