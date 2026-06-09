import { EpicDateString } from '../../common'


export type EpicSvtTestSetupConfigEntity = {
    id: number
    setupId: number
    name: string
    note: string
    createdAt: EpicDateString
}

export type EpicSvtTestSetupConfigBodyEntity = {
    id: number
    configBody: string // JSON string
}

export type EpicSvtTestSetupConfigCreateEntity = {
    setupId: number
    name: string
    configBody: string // JSON string
    note: string | null

}
