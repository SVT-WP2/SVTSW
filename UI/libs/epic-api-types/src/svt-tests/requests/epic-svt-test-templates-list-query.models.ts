/**
 * Query string of `GET /api/svt-test-templates` — an omitted / `null` / empty member does not narrow the list
 * down.
 */
export type EpicSvtTestTemplatesListQuery = {
    ids?: number[] | null
    /** Enum values of `dutType`. */
    dutTypes?: string[] | null
}
