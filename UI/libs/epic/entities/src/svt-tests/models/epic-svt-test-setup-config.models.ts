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
    configBody: string // text file content (JSON, JSON5, ...)
}

export type EpicSvtTestSetupConfigCreateEntity = {
    setupId: number
    name: string
    configBody: string // text file content (JSON, JSON5, ...)
    note: string | null

}
