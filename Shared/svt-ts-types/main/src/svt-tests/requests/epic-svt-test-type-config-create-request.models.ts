/**
 * Body of `POST /api/svt-test-type-configs`.
 */
export type EpicSvtTestTypeConfigCreateRequest = {
    testTypeId: number
    name: string
    /** Config file content as plain text (JSON, JSON5 or any other text format). */
    configBody: string
    note: string | null
}
