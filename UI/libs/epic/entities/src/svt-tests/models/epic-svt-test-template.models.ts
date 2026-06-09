export type EpicSvtTestTemplateEntity = {
    id: number
    dutType: string
    isEnabled: boolean
    testTypeId: number
    testTypeConfigId: number
}

export type EpicSvtTestTemplateCreateEntity = {
    dutType: string
    testTypeConfigId: number
    isEnabled: boolean
}

export type EpicSvtTestTemplateUpdateEntity = {
    isEnabled: boolean
}

export type EpicSvtTestTemplatesGetAllParams = {
    ids?: number[]
    dutTypes?: string[]
}
