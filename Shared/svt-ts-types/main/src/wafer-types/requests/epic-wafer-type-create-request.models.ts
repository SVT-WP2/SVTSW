/**
 * Body of `POST /api/wafer-types`.
 */
export type EpicWaferTypeCreateRequest = {
    name: string
    /** Enum value of `engineeringRun` (see the enums endpoint). */
    engineeringRun: string
    /** Enum value of `foundryName` (see the enums endpoint). */
    foundry: string
    /** Enum value of `waferTech` (see the enums endpoint). */
    technology: string
    /** Stringified JSON. */
    waferMap: string
}
