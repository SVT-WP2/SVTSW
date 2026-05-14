import { EpicAsicTestStatus } from './epic-asic-test-status.models'


export type EpicAsicTest = {
    id: number
    waferTestId: number
    asicId: number
    createdAt: string | null
    startedAt: string | null
    finishedAt: string | null
    status: EpicAsicTestStatus // EpicAsicTestStatus.None is a default value
}

