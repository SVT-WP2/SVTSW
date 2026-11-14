/**
 * Filter part of the `GET /api/chips` query string; the paging part is `EpicApiPager`. Every member is optional —
 * an omitted / `null` / empty one means "do not narrow the list down by it".
 */
export type EpicChipsListQuery = {
    ids?: number[] | null
    /** Search term matched against `serialNumber`. */
    serialNumber?: string | null
    /** Enum value of `wpGeneralLocation`. */
    generalLocation?: string | null
    /** Enum values of `asicFamilyType`; a chip matches when its `familyType` is one of them. */
    familyTypes?: string[] | null
}
