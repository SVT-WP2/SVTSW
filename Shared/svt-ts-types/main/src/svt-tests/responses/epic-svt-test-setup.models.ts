/**
 * An SVT test setup as the `/api/svt-test-setups` endpoints return it.
 */
export type EpicSvtTestSetup = {
    id: number
    name: string
    /** `null` when the setup has no default config. */
    defaultConfigId: number | null
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
}
