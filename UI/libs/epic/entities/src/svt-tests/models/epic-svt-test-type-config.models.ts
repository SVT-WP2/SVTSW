import { EpicDateString } from '../../common'


export type EpicSvtTestTypeConfigEntity = {
    id: number
    testTypeId: number
    name: string
    note: string | null
    createdAt: EpicDateString
}

export type EpicSvtTestTypeConfigBodyEntity = {
    id: number
    configBody: string // text file content (JSON, JSON5, ...)
}

export type EpicSvtTestTypeConfigCreateEntity = {
    testTypeId: number
    name: string
    configBody: string // text file content (JSON, JSON5, ...)
    note: string | null
}

export type EpicSvtTestTypeConfigsGetAllParams = {
    ids?: number[]
    testTypeId?: number
}
