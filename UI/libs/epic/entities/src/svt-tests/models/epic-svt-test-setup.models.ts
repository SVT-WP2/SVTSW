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
        configBody: string // JSON string
        note: string | null
    }

}

export type EpicSvtTestSetupUpdateEntity = {
    defaultConfigId: number
}
