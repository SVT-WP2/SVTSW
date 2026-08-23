import { EpicDateTimeString } from 'epic/entities'

import { EpicSvtTestResultStatus } from './epic-svt-test-result-status.models'
import { EpicSvtTestStatus } from './epic-svt-test-status.models'


export enum EpicSvtDutEntityName {
    Asic = 'Asic',
    Chip = 'Chip',
    ChipBlock = 'ChipBlock',
}

export type EpicSvtTestEntity = {
    id: number
    dutEntityName: EpicSvtDutEntityName
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
    createdAt: EpicDateTimeString
    startedAt: EpicDateTimeString
    finishedAt: EpicDateTimeString
    pathToResult: string
    testResultStatus: EpicSvtTestResultStatus
}

/**
 * `EpicSvtTestEntity` as returned by the DB agent carries only physically-stored fields. The BFF enriches it
 * with the synthetic `status` (see resolveEpicSvtTestStatus) before handing it to the UI.
 */
export type EpicSvtTestResolvedEntity = EpicSvtTestEntity & {
    status: EpicSvtTestStatus
}

export type EpicSvtTestCreateEntity = {
    dutEntityName: EpicSvtDutEntityName
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
}

export type EpicSvtTestsGetAllParams = {
    ids?: number[]
    dutEntityNames?: string[]
}
