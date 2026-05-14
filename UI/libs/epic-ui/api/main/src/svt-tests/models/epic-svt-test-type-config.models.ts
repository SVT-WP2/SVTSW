export type EpicSvtTestTypeConfig = {
    id: number
    testTypeId: number
    name: string
    note: string | null
    createdAt: string
}

export type EpicSvtTestTypeConfigBody = {
    id: number
    configBody: string // JSON string
}

export type EpicSvtTestTypeConfigCreate = {
    testTypeId: number
    name: string
    configBody: string // JSON string
    note: string | null
}
