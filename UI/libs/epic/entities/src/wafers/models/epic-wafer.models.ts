import { EpicDateString } from '../../common'


export type EpicWaferEntity = {
    id: number
    serialNumber: string
    batchNumber: number
    thinningDate: EpicDateString | null
    dicingDate: EpicDateString | null
    productionDate: EpicDateString | null
    waferTypeId: number
    generalLocation: string | null
}

// OTHER :: Just ideas

// export type EpicWaferDieTest<TConfig extends Record<string, unknown>> = {
//     id: string
//     waferId: string
//     dieName: string // enum for particular wafer, should not be modified by user
//     type: EpicWaferDieTestType
//     status: EpicWaferDieTestStatus
//     config: TConfig
// }
//
// export enum EpicWaferDieTestStatus {
//     None = 'None',
//     Processing = 'Processing',
//     ProcessingError = 'ProcessingError',
//     FinishedNotEvaluated = 'FinishedNotEvaluated',
//     Passed = 'Passed',
//     Failed = 'Failed',
// }
//
// export enum EpicWaferDieTestType {
//     Breakdown = 'Breakdown',
//     StripShortCircuit = 'StripShortCircuit',
// }
//
// // BE level entity
// export type EpicWaferDieTestToMeasure = {
//     waferDieTestId: string
//     measurementId: string
// }
//
// export enum EpicMeasureType {
//     IvMnt = 'IvMnt',
// }
