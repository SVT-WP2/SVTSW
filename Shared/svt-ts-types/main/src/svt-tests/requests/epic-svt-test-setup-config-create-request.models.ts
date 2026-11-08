/**
 * Body of `POST /api/svt-test-setup-configs`.
 */
export type EpicSvtTestSetupConfigCreateRequest = {
    setupId: number
    name: string
    /** Config file content as plain text: JSON or JSON5. */
    configBody: string
    note: string | null
}
