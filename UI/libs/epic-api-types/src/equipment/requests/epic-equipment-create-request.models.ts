/**
 * Body of `POST /api/equipment`.
 */
export type EpicEquipmentCreateRequest = {
    name: string
    equipmentTypeId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    /** Stringified JSON. */
    specification: string
}
