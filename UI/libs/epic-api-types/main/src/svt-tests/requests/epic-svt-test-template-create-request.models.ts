/**
 * Body of `POST /api/svt-test-templates`.
 */
export type EpicSvtTestTemplateCreateRequest = {
    /** Enum value of `dutType` (see the enums endpoint). */
    dutType: string
    testTypeConfigId: number
    isEnabled: boolean
}

/**
 * Body of `PATCH /api/svt-test-templates/:id`.
 */
export type EpicSvtTestTemplateUpdateRequest = {
    isEnabled: boolean
}
