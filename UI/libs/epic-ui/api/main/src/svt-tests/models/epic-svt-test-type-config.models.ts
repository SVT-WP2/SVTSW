export type EpicSvtTestTypeConfig = {
    id: number
    testTypeId: number
    name: string
    note: string | null
    createdAt: string
}

export type EpicSvtTestTypeConfigBody = {
    id: number
    configBody: string // text file content (JSON, JSON5, ...)
}

export type EpicSvtTestTypeConfigCreate = {
    testTypeId: number
    name: string
    configBody: string // text file content (JSON, JSON5, ...)
    note: string | null
}
