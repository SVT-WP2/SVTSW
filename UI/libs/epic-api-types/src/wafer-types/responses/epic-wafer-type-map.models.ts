/**
 * Response of `GET /api/wafer-types/:waferTypeId/wafer-map`.
 */
export type EpicWaferTypeMap = {
    /** Stringified JSON. */
    waferMap: string
}
