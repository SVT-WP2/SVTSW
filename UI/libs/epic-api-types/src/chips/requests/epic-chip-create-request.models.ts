/**
 * Body of `POST /api/chips`.
 */
export type EpicChipCreateRequest = {
    serialNumber: string
    /** The ASIC the chip is made of. */
    asicId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
}
