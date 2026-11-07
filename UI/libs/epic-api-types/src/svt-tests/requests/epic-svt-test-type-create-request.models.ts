/**
 * The config created together with a new test type.
 */
export type EpicSvtTestTypeDefaultConfigCreateRequest = {
    name: string
    /** Config file content as plain text (JSON, JSON5 or any other text format). */
    configBody: string
    note: string | null
}

/**
 * Body of `POST /api/svt-test-types`.
 */
export type EpicSvtTestTypeCreateRequest = {
    name: string
    /** Enum values of `dutType` (see the enums endpoint). */
    dutTypes: string[]
    testTypeConfig: EpicSvtTestTypeDefaultConfigCreateRequest
}

/**
 * Body of `PATCH /api/svt-test-types/:id`.
 */
export type EpicSvtTestTypeUpdateRequest = {
    /** Enum values of `dutType` (see the enums endpoint). */
    dutTypes: string[]
}
