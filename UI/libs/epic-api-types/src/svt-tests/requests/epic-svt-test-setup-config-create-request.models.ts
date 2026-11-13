/**
 * Body of `POST /api/svt-test-setup-configs`.
 */
export type EpicSvtTestSetupConfigCreateRequest = {
    setupId: number
    name: string
    /** Config file content as plain text (JSON, JSON5 or any other text format). */
    configBody: string
    note: string | null
}
