/**
 * Body of `POST /api/asics`.
 */
export type EpicAsicCreateRequest = {
    serialNumber: string
    waferId: number
    /** Enum value of `asicFamilyType` (see the enums endpoint). */
    familyType: string
    waferMapPosition: string
    /** Enum value of `asicQuality` (see the enums endpoint). */
    quality: string
}
