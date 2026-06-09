import { EpicWaferTestStatus } from './epic-wafer-test-status.models'


export type EpicWaferTest = {
    id: number
    name: string
    description: string | null
    wpMachineId: number
    waferId: number
    asicTestTypeId: number
    asicIds: number[]
    createdAt: string | null
    startedAt: string | null
    finishedAt: string | null
    status: EpicWaferTestStatus // WaferTestStatus.None is a default value
    testConfig?: EpicWaferTestBasicConfig & Record<string, any>
}

export type EpicWaferTestCreate = {
    wpMachineId: number
    waferId: number
    asicIds: number[]
    name: string
    description: string | null
    asicTestTypeId: number
    testConfig?: EpicWaferTestBasicConfig & Record<string, any> // JSON
}

export type EpicWaferTestUpdate = {
    name?: string
    description?: string | null
}

export type EpicWaferTestBasicConfig = {
    skipInitialAlignment?: boolean
    skipPtpaForEachStep?: boolean
    voltage?: number | null
}

