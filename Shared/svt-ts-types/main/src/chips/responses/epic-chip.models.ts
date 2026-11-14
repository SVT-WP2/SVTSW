/**
 * A chip as the `/api/chips` endpoints return it.
 */
export type EpicChip = {
    id: number
    serialNumber: string
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    /** Enum value of `asicFamilyType` (see the enums endpoint) — inherited from the ASIC the chip was made of. */
    familyType: string
}
