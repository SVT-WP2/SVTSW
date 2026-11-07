/**
 * An SVT test template as the `/api/svt-test-templates` endpoints return it: "run this test type config on
 * every DUT of this type".
 */
export type EpicSvtTestTemplate = {
    id: number
    /** Enum value of `dutType` (see the enums endpoint). */
    dutType: string
    isEnabled: boolean
    testTypeId: number
    testTypeConfigId: number
}
