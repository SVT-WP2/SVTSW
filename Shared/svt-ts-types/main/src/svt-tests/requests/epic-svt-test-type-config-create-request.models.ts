/**
 * Body of `POST /api/svt-test-type-configs`.
 */
export type EpicSvtTestTypeConfigCreateRequest = {
    testTypeId: number
    name: string
    /** Config file content as plain text: JSON or JSON5. */
    configBody: string
    note: string | null
}
