/**
 * The config created together with a new test setup and made its default one.
 */
export type EpicSvtTestSetupDefaultConfigCreateRequest = {
    name: string
    /** Config file content as plain text (JSON, JSON5 or any other text format). */
    configBody: string
    note: string | null
}

/**
 * Body of `POST /api/svt-test-setups`.
 */
export type EpicSvtTestSetupCreateRequest = {
    name: string
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    defaultConfig: EpicSvtTestSetupDefaultConfigCreateRequest
}

/**
 * Body of `PATCH /api/svt-test-setups/:id`.
 */
export type EpicSvtTestSetupUpdateRequest = {
    defaultConfigId: number
}
