import { SvtDbWaferMap, SvtDbWaferMapColumn, SvtDbWaferMapGroupElement, SvtDbWaferMapRow } from './svt-db-wafer-map.models'


export type SvtDbWaferMapValidation =
    | { valid: true; map: SvtDbWaferMap }
    | { valid: false; errors: string[] }

/**
 * `checkWaferTypeMap` of the C++ agent (`DbAgent/docs/06-wafer-map.md` §3), same rules and messages.
 * Rules 1–4 accumulate every violation; rules 5–8 stop at the first one. `asicFamilyTypes` are the live
 * values of the `asicFamilyType` enum.
 */
export function validateWaferMap(text: string, asicFamilyTypes: readonly string[]): SvtDbWaferMapValidation {
    let parsed: unknown
    try {
        parsed = JSON.parse(text)
    }
    catch {
        return { valid: false, errors: ['WaferTypeMap don\'t follow json format.'] }
    }

    if (!isRecord(parsed) || !isRecord(parsed['Groups']) || !isRecord(parsed['MapGroups'])) {
        return { valid: false, errors: ['Wrong json format. Missing Groups or MapGroups objects.'] }
    }
    if (asicFamilyTypes.length === 0) {
        return { valid: false, errors: ['No ASIC FamilyType found.'] }
    }

    const groups = parsed['Groups']
    const mapGroups = parsed['MapGroups']
    const errors: string[] = []

    for (const [groupName, elements] of Object.entries(groups)) {
        if (!Array.isArray(elements)) {
            errors.push(`Group ${groupName} is not a list of elements`)
            continue
        }
        elements.forEach((element: Partial<SvtDbWaferMapGroupElement> | null, index) => {
            if (element?.PosInGroup !== index) {
                errors.push(`Unmatching PosInGroup index: ${String(element?.PosInGroup)} from expected ${index} in group ${groupName}`)
            }
            if (typeof element?.FamilyType !== 'string' || !asicFamilyTypes.includes(element.FamilyType)) {
                errors.push(`Asic Family type: ${String(element?.FamilyType)} is not part of enum value in the DB`)
            }
        })
    }

    for (const [rowName, row] of Object.entries(mapGroups)) {
        const columns = (row as Partial<SvtDbWaferMapRow> | null)?.MapGroupsColumns
        if (!Array.isArray(columns)) {
            errors.push(`Map Group: ${rowName} has no MapGroupsColumns list`)
            return { valid: false, errors }
        }
        for (const [columnIndex, column] of (columns as Partial<SvtDbWaferMapColumn>[]).entries()) {
            const where = `Map Group: ${rowName} Col: ${columnIndex}`
            const group = typeof column.GroupName === 'string' ? groups[column.GroupName] : undefined
            if (!Array.isArray(group)) {
                errors.push(`${where} group name ${String(column.GroupName)} was not found`)
                return { valid: false, errors }
            }
            const size = group.length
            const existing = resolveIndexList(column.ExistingAsics, size)
            const damaged = resolveIndexList(column.MechanicallyDamagedASICs, size)
            const covered = resolveIndexList(column.ASICsCoveredByGreenLayer, size)
            const integer = resolveIndexList(column.MechanicallyIntegerASICs, size)
            if (!existing || !damaged || !covered || !integer) {
                errors.push(`${where} Wrong array found`)
                return { valid: false, errors }
            }
            if (existing.length > size || existing.length !== damaged.length + covered.length + integer.length) {
                errors.push(`${where}, unmaching number of asics and properties size`)
                return { valid: false, errors }
            }
            for (const index of existing) {
                const properties = [damaged, covered, integer].filter((list) => list.includes(index)).length
                if (properties !== 1) {
                    errors.push(`${where}, asic index ${index} has more than one property`)
                    return { valid: false, errors }
                }
            }
        }
    }

    return errors.length > 0 ? { valid: false, errors } : { valid: true, map: parsed as SvtDbWaferMap }
}

/**
 * Expands an index list (06 §2): `null`/missing/`[]` → none, `['All']` → `0 … groupSize - 1`, numbers → as
 * given. `undefined` means the value is not a valid index list.
 */
export function resolveIndexList(value: unknown, groupSize: number): number[] | undefined {
    if (value === null || value === undefined) {
        return []
    }
    if (!Array.isArray(value)) {
        return undefined
    }
    if (value.length === 0) {
        return []
    }
    if (value[0] === 'All') {
        return Array.from({ length: groupSize }, (_, index) => index)
    }
    if (value.every((item) => typeof item === 'number' && Number.isInteger(item))) {
        return value as number[]
    }
    return undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}
