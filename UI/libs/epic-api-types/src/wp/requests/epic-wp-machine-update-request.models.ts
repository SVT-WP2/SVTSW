/**
 * Body of `PATCH /api/wp-machines/:id`.
 */
export type EpicWpMachineUpdateRequest = {
    hostName: string
    /** Enum value of `wpConnectionType` (see the enums endpoint). */
    connectionType: string
    connectionPort: number
    /** Enum value of `wpGeneralLocation` (see the enums endpoint). */
    generalLocation: string
    /** Enum value of `wpSwType` (see the enums endpoint). */
    software: string
    swVersion: string
}
