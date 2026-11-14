/**
 * Body of `POST /api/wp-projects`.
 */
export type EpicWpProjectCreateRequest = {
    wpMachineId: number
    waferTypeId: number
    name: string
    /** Enum value of `asicFamilyType` (see the enums endpoint). */
    asicFamilyType: string
    /** Enum value of `waferMapOrientation` (see the enums endpoint). */
    orientation: string
    alignmentDie: string
    homeDie: string
    /** Stringified JSON. */
    local2GlobalMap: string
}
