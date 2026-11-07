/**
 * A chip block as the `/api/chip-blocks` endpoints return it.
 */
export type EpicChipBlock = {
    id: number
    chipId: number
    /** Enum value of `blockType` (see the enums endpoint). */
    chipBlockType: string
    serialNumber: string
}
