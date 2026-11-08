import { EpicDateString } from '../../common'


/**
 * Body of `POST /api/chips/:chipId/location`.
 */
export type EpicChipLocationUpdateRequest = {
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    note: string
    date: EpicDateString | null
}
