export type EpicSvtTestSetupConfig = {
    id: number
    setupId: number
    name: string
    note: string | null
    createdAt: string
}

export type EpicSvtTestSetupConfigBody = {
    id: number
    configBody: string // JSON string
}

export type EpicSvtTestSetupConfigCreate = {
    setupId: number
    name: string
    configBody: string // JSON string
    note: string | null
}
