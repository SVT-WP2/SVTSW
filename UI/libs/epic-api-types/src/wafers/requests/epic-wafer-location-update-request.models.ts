import { EpicDateString } from '../../common'


/**
 * Body of `POST /api/wafers/:waferId/location`.
 */
export type EpicWaferLocationUpdateRequest = {
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    note: string
    date: EpicDateString | null
}
