import { EpicDateString } from '../../common'


/**
 * Body of `POST /api/wafers`.
 */
export type EpicWaferCreateRequest = {
    serialNumber: string
    batchNumber: number
    thinningDate: EpicDateString | null
    dicingDate: EpicDateString | null
    productionDate: EpicDateString | null
    waferTypeId: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string | null
}
