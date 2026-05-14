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
    configBody: string // JSON string
}

export type EpicSvtTestTypeConfigCreateEntity = {
    testTypeId: number
    name: string
    configBody: string // JSON string
    note: string | null
}

export type EpicSvtTestTypeConfigsGetAllParams = {
    ids?: number[]
    testTypeId?: number
}
