import { EpicDateString } from '../../common'


/**
 * A wafer as `GET /api/wafers`, `GET /api/wafers/:waferId`, `POST /api/wafers` and `PATCH /api/wafers/:waferId`
 * return it.
 */
export type EpicWafer = {
    id: number
    serialNumber: string
    batchNumber: number
    thinningDate: EpicDateString | null
    dicingDate: EpicDateString | null
    productionDate: EpicDateString | null
    waferTypeId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint), `null` while unknown. */
    generalLocation: string | null
}
