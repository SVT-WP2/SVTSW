import { EpicDateString } from '../../common'


export type EpicWaferCreateEntity = {
    serialNumber: string
    batchNumber: number
    thinningDate: EpicDateString | null
    dicingDate: EpicDateString | null
    productionDate: EpicDateString | null
    waferTypeId: number
    generalLocation: string | null
}
