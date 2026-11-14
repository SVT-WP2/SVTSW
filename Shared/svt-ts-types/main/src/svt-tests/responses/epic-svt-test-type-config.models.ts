import { EpicDateTimeString } from '../../common'


/**
 * A test type config as `GET /api/svt-test-type-configs` returns it — the metadata only, the config file
 * itself is `EpicSvtTestTypeConfigBody`.
 */
export type EpicSvtTestTypeConfig = {
    id: number
    testTypeId: number
    name: string
    note: string | null
    createdAt: EpicDateTimeString
}

/**
 * Response of `GET /api/svt-test-type-configs/:id/config-body`.
 */
export type EpicSvtTestTypeConfigBody = {
    id: number
    /** Config file content as plain text (JSON, JSON5 or any other text format). */
    configBody: string
}
