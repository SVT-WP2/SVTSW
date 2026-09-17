export type EpicSvtTestType = {
    id: number
    name: string
    dutTypes: string[]
}

export type EpicSvtTestTypeCreate = {
    name: string
    dutTypes: string[]
    testTypeConfig: {
        name: string
        configBody: string // text file content (JSON, JSON5, ...)
        note: string | null
    }
}

export type EpicSvtTestTypeUpdate = {
    dutTypes: string[]
}

