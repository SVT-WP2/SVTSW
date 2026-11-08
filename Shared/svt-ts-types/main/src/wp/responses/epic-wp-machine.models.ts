/**
 * A wafer-prober machine as the `/api/wp-machines` endpoints return it.
 */
export type EpicWpMachine = {
    id: number
    name: string
    serialNumber: string
    hostName: string
    /** Enum value of `wpConnectionType` (see the enums endpoint). */
    connectionType: string
    connectionPort: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    /** Enum value of `wpSwType` (see the enums endpoint). */
    software: string
    swVersion: string
    /** Enum value of `wpVendor` (see the enums endpoint). */
    vendor: string
    loadedWaferId: number | null
    /** Enum value of `waferMapOrientation`; `null` while no wafer is loaded. */
    loadedWaferOrientation: string | null
    installedProbeCardId: number | null
    /** Enum value of `waferMapOrientation`; may be `null` for an installed card too (the orientation is optional there). */
    installedProbeCardOrientation: string | null
}
