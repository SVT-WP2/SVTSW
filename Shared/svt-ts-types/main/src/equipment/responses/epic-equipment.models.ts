/**
 * A piece of equipment as the `/api/equipment` endpoints return it.
 */
export type EpicEquipment = {
    id: number
    name: string
    equipmentTypeId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    /** Stringified JSON, `null` when the equipment has no specification. */
    specification: string | null
}
