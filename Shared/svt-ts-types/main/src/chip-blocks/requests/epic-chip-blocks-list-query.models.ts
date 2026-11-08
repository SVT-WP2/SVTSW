/**
 * Filter part of the `GET /api/chip-blocks` query string; the paging part is `EpicApiPager`. Every member is
 * optional — an omitted / `null` / empty one means "do not narrow the list down by it".
 */
export type EpicChipBlocksListQuery = {
    ids?: number[] | null
    chipId?: number | null
    /** Enum values of `blockType`; a chip block matches when its `chipBlockType` is one of them. */
    chipBlockTypes?: string[] | null
    /** Search term matched against `serialNumber`. */
    serialNumber?: string | null
}
