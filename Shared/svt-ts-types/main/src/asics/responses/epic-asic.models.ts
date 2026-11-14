/**
 * An ASIC as `GET /api/asics`, `GET /api/asics/:asicId` and `POST /api/asics` return it.
 *
 * Used as-is by the Angular SPA; the NestJS BFF serialises it through `EpicAsicDto implements EpicAsic`.
 */
export type EpicAsic = {
    id: number
    serialNumber: string
    waferId: number
    /** Set once a chip has been created from the ASIC, `null` / absent otherwise. */
    chipId?: number | null
    /** Enum value of `asicFamilyType` (see the enums endpoint). */
    familyType: string
    waferMapPosition: string
    /** Enum value of `asicQuality` (see the enums endpoint). */
    quality: string
}
