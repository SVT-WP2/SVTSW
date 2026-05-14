import { EpicMntStatus } from './epic-mnt-status.models'


export type EpicMeasurement = {
    id: string
    status: EpicMntStatus
    name: string
    note?: string
    labels: string[]
    errorMessage?: string
    isActive: boolean
    startedAt: string
    createdAt: string
    finishedAt: string
    updatedAt: string
}
