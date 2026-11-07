import { EpicDateTimeString } from '../../common'


/**
 * A test setup config as `GET /api/svt-test-setup-configs` returns it — the metadata only, the config file
 * itself is `EpicSvtTestSetupConfigBody`.
 */
export type EpicSvtTestSetupConfig = {
    id: number
    setupId: number
    name: string
    note: string | null
    createdAt: EpicDateTimeString
}

/**
 * Response of `GET /api/svt-test-setup-configs/:id/config-body`.
 */
export type EpicSvtTestSetupConfigBody = {
    id: number
    /** Config file content as plain text (JSON, JSON5 or any other text format). */
    configBody: string
}
