import { EpicDateString } from '../../common'


/**
 * Body of `POST /api/equipment/:equipmentId/location`.
 */
export type EpicEquipmentLocationUpdateRequest = {
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    note: string
    date: EpicDateString | null
}
