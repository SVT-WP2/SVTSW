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
    /**
     * Free text that a client sent with the move (the key `username` of the request). The UI sends none. Rows from
     * before the users of #392 may hold a name here.
     */
    username: string | null
    /** The id of the user of the request that wrote the row; `null` for a row without one (older rows, no user). */
    userId: number | null
    /** The name of that user (`SvtUser.name`), also of a user who was switched off later; `null` without a user. */
    userName: string | null
}
