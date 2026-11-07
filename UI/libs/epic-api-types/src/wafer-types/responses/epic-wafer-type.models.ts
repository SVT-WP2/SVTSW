/**
 * A wafer type as `GET /api/wafer-types`, `GET /api/wafer-types/:id` and `POST /api/wafer-types` return it.
 */
export type EpicWaferType = {
    id: number
    name: string
    /** Enum value of `engineeringRun` (see the enums endpoint). */
    engineeringRun: string
    /** Enum value of `foundryName` (see the enums endpoint). */
    foundry: string
    /** Enum value of `waferTech` (see the enums endpoint). */
    technology: string
}
