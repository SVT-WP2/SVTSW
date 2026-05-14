export type EpicSvtTestSetup = {
    id: number
    name: string
    defaultConfigId: number
    generalLocation: string
}

export type EpicSvtTestSetupCreate = {
    name: string
    generalLocation: string
    defaultConfig: {
        name: string
        configBody: string // JSON string
        note: string | null
    }
}

export type EpicSvtTestSetupUpdate = {
    defaultConfigId: number
}

