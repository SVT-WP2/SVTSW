export type EpicSvtTestTypeEntity = {
    id: number
    name: string
    dutTypes: string[]
}

export type EpicSvtTestTypeCreateEntity = {
    name: string
    dutTypes: string[]
    testTypeConfig: {
        name: string
        configBody: string // JSON string
        note: string | null
    }
}

export type EpicSvtTestTypeUpdateEntity = {
    dutTypes: string[]
}

export type EpicSvtTestTypesGetAllParams = {
    ids?: number[]
    dutTypes?: string[]
}
