export type EpicSvtTestSetupConfig = {
    id: number
    setupId: number
    name: string
    note: string | null
    createdAt: string
}

export type EpicSvtTestSetupConfigBody = {
    id: number
    configBody: string // text file content (JSON, JSON5, ...)
}

export type EpicSvtTestSetupConfigCreate = {
    setupId: number
    name: string
    configBody: string // text file content (JSON, JSON5, ...)
    note: string | null
}
