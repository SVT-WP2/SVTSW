import { resolveIndexList } from './svt-db-wafer-map-validation'
import { SvtDbWaferMap } from './svt-db-wafer-map.models'


/** The `asicQuality` enum values the generator assigns. */
export type SvtDbAsicQuality = 'MechanicallyDamaged' | 'CoveredByGreenLayer' | 'MechanicallyInteger'

/** One die to insert into `Asic` for a new wafer (the wafer id is added by the repository). */
export type SvtDbGeneratedAsic = {
    serialNumber: string
    waferMapPosition: string
    familyType: string
    quality: SvtDbAsicQuality
}

const ROW_KEY_PREFIX = 'MapGroupsRow'

/**
 * The C++ agent's ASIC generation (`DbAgent/docs/06-wafer-map.md` §4), reproduced exactly; it regenerates
 * every `Asic` row of the 2026-11-08 dumps (see the spec).
 *
 * - Rows are processed in numeric order of the `MapGroupsRow<n>` suffix.
 * - `waferMapPosition` is `"<row>_<col>"`, where `col` counts existing dies across all columns of the row.
 * - Serial number: `<waferSN>_<row>_<col>`; an intact die in a row with `SN_prefix` gets `<prefix>_<waferSN>`,
 *   and `<prefix>_<k>_<waferSN>` (k = 1-based count of intact dies in the row) when the prefix contains
 *   `babyMOSAIX-`.
 * - Quality precedence when a die is listed in several lists: damaged, covered, intact.
 *
 * The map is expected to have passed `validateWaferMap`; the remaining impossible states throw.
 */
export function generateAsics(waferSerialNumber: string, map: SvtDbWaferMap): SvtDbGeneratedAsic[] {
    const rows = Object.keys(map.MapGroups)
        .map((key) => ({ key, index: Number.parseInt(key.slice(ROW_KEY_PREFIX.length), 10) }))
        .sort((left, right) => left.index - right.index)

    const asics: SvtDbGeneratedAsic[] = []
    for (const { key, index: row } of rows) {
        const rowDefinition = map.MapGroups[key]
        const snPrefix = rowDefinition.SN_prefix ?? ''
        let col = 0
        let intactBabyMosaix = 0

        for (const column of rowDefinition.MapGroupsColumns) {
            const group = map.Groups[column.GroupName]
            if (!group) {
                throw new Error(`Map Group: ${key} group name ${column.GroupName} was not found`)
            }
            const existing = requireIndexList(column.ExistingAsics, group.length)
            const damaged = requireIndexList(column.MechanicallyDamagedASICs, group.length)
            const covered = requireIndexList(column.ASICsCoveredByGreenLayer, group.length)
            const intact = requireIndexList(column.MechanicallyIntegerASICs, group.length)

            for (const index of existing) {
                const waferMapPosition = `${row}_${col}`
                const quality: SvtDbAsicQuality | undefined = damaged.includes(index) ? 'MechanicallyDamaged'
                    : covered.includes(index) ? 'CoveredByGreenLayer'
                        : intact.includes(index) ? 'MechanicallyInteger'
                            : undefined
                if (!quality) {
                    throw new Error(`Wrong Asic quality property for asic ${index}`)
                }
                const familyType = group[index]?.FamilyType
                if (!familyType) {
                    throw new Error(`invalid familyType for asic ${index} in group ${column.GroupName}`)
                }

                let serialNumber: string
                if (quality === 'MechanicallyInteger' && snPrefix !== '') {
                    serialNumber = snPrefix
                    if (snPrefix.includes('babyMOSAIX-')) {
                        intactBabyMosaix += 1
                        serialNumber += `_${intactBabyMosaix}`
                    }
                    serialNumber += `_${waferSerialNumber}`
                }
                else {
                    serialNumber = `${waferSerialNumber}_${waferMapPosition}`
                }

                asics.push({ serialNumber, waferMapPosition, familyType, quality })
                col += 1
            }
        }
    }
    return asics
}

function requireIndexList(value: unknown, groupSize: number): number[] {
    const list = resolveIndexList(value, groupSize)
    if (!list) {
        throw new Error('Wrong array found')
    }
    return list
}
