import { EpicDateString } from '../../common'


/**
 * One entry of `GET /api/wafers/:waferId/location-history`.
 */
export type EpicWaferLocationHistoryRecord = {
    waferId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
