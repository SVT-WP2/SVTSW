/**
 * Filter part of the `GET /api/asics` query string; the paging part is `EpicApiPager`. Every member is
 * optional — an omitted / `null` / empty one means "do not narrow the list down by it".
 */
export type EpicAsicsListQuery = {
    waferId?: number | null
    chipId?: number | null
    /** Enum values of `asicFamilyType`; an ASIC matches when its `familyType` is one of them. */
    asicFamilyTypes?: string[] | null
    /** Enum value of `asicQuality`. */
    asicQuality?: string | null
    /** Search term matched against `serialNumber`. */
    serialNumber?: string | null
}
