import { EpicDateString } from '../../common'


/**
 * One entry of `GET /api/chips/:chipId/location-history`.
 */
export type EpicChipLocationHistoryRecord = {
    chipId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
