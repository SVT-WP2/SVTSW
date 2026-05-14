export type EpicSvtTestTemplate = {
    id: number
    dutType: string
    isEnabled: boolean
    testTypeId: number
    testTypeConfigId: number
}

export type EpicSvtTestTemplateCreate = {
    dutType: string
    testTypeConfigId: number
    isEnabled: boolean
}

export type EpicSvtTestTemplateUpdate = {
    isEnabled: boolean
}

