import { EpicDateString } from '../../common'


/**
 * One entry of `GET /api/equipment/:equipmentId/location-history`.
 */
export type EpicEquipmentLocationHistoryRecord = {
    equipmentId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
