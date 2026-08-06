import { EpicSvtTestResultStatus } from './epic-svt-test-result-status.models'
import { EpicSvtTestStatus } from './epic-svt-test-status.models'


export type EpicSvtTest = {
    id: number
    dutEntityName: EpicSvtDutEntityName // enum
    dutId: number
    testTypeConfig: number
    testSetupConfigId: number
    createdAt: string
    startedAt: string
    finishedAt: string
    pathToResult: string
    testResultStatus: EpicSvtTestResultStatus // enum
    status: EpicSvtTestStatus // enum
}

export type EpicSvtTestCreate = {
    dutEntityName: EpicSvtDutEntityName // enum
    dutId: number
    testTypeConfig: number
    testSetupConfigId: number
}

export enum EpicSvtDutEntityName {
    Asic = 'Asic',
    Chip = 'Chip',
    ChipBlock = 'ChipBlock',
}
