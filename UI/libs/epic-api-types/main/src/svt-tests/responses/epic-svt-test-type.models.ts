/**
 * An SVT test type as the `/api/svt-test-types` endpoints return it.
 */
export type EpicSvtTestType = {
    id: number
    name: string
    /** Enum values of `dutType` (see the enums endpoint). */
    dutTypes: string[]
}
