import { EpicDateString } from '../../common'


/**
 * A probe card as the `/api/wp-probe-cards` endpoints return it.
 */
export type EpicWpProbeCard = {
    id: number
    serialNumber: string
    /** Enum value of `pcName` (see the enums endpoint). */
    name: string
    /** Enum value of `pcVendor` (see the enums endpoint). */
    vendor: string
    /** Enum value of `pcModel` (see the enums endpoint). */
    model: string
    arriveDate: EpicDateString
    /** Enum value of `pcLocation` (see the enums endpoint). */
    location: string
    /** Enum value of `pcType` (see the enums endpoint). */
    type: string
    vendorCleaningInterval: number
}
