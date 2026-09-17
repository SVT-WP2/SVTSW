export type EpicSvtTestSetupEntity = {
    id: number
    name: string
    defaultConfigId: number
    generalLocation: string
}

export type EpicSvtTestSetupCreateEntity = {
    name: string
    generalLocation: string
    defaultConfig: {
        name: string
        configBody: string // text file content (JSON, JSON5, ...)
        note: string | null
    }

}

export type EpicSvtTestSetupUpdateEntity = {
    defaultConfigId: number
}
