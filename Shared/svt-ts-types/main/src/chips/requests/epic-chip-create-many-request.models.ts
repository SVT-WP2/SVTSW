export type EpicChipCreateManyRequestItem = {
    serialNumber: string
    /** The ASIC the chip is made of. */
    asicId: number
}

/**
 * Body of `POST /api/chips/create-many` — every item gets the same `generalLocation`.
 */
export type EpicChipCreateManyRequest = {
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    items: EpicChipCreateManyRequestItem[]
}
