/**
 * The wafer map JSON stored in `WaferTypeMap.waferMap`; format and rules in `DbAgent/docs/06-wafer-map.md`.
 * Property names are the file's (PascalCase); informational header fields are kept as unknown extras.
 */
export type SvtDbWaferMapGroupElement = {
    PosInGroup: number
    /** A value of the `asicFamilyType` enum. */
    FamilyType: string
}

/**
 * An index list of a map column: `null`/missing/`[]` = none, `['All']` = every index of the group,
 * `[0, 3, 4]` = exactly those `PosInGroup` indices.
 */
export type SvtDbWaferMapIndexList = ('All' | number)[] | null

export type SvtDbWaferMapColumn = {
    /** Must exist in `Groups`. */
    GroupName: string
    /** Informational, not read. */
    Property?: string
    ExistingAsics?: SvtDbWaferMapIndexList
    MechanicallyDamagedASICs?: SvtDbWaferMapIndexList
    ASICsCoveredByGreenLayer?: SvtDbWaferMapIndexList
    MechanicallyIntegerASICs?: SvtDbWaferMapIndexList
}

export type SvtDbWaferMapRow = {
    /** Optional serial-number prefix of the row (06 §4). */
    SN_prefix?: string
    MapGroupsColumns: SvtDbWaferMapColumn[]
}

export type SvtDbWaferMap = {
    Groups: Record<string, SvtDbWaferMapGroupElement[]>
    MapGroups: Record<string, SvtDbWaferMapRow>
    [header: string]: unknown
}
