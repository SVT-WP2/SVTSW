// @vitest-environment node
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { SVT_DB_ENUM_VALUES } from '../enums'

import { resolveIndexList, validateWaferMap } from './svt-db-wafer-map-validation'


const FAMILY_TYPES = SVT_DB_ENUM_VALUES.asicFamilyType
const ER2_MAP = readFileSync(resolve(__dirname, '../../../../../../../Configurations/WaferTypeMappings/ER2WaferMap_v0.json'), 'utf8')

const minimalMap = (overrides: Record<string, unknown> = {}) => JSON.stringify({
    Groups: {
        Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }, { PosInGroup: 1, FamilyType: 'BABYMOSAIX' }],
    },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [1],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: [0],
            }],
        },
    },
    ...overrides,
})

describe('validateWaferMap', () => {

    it('accepts the production ER2 wafer map', () => {
        const result = validateWaferMap(ER2_MAP, FAMILY_TYPES)
        expect(result.valid).toBe(true)
        if (result.valid) {
            expect(Object.keys(result.map.Groups).length).toBeGreaterThan(0)
        }
    })

    it('accepts a minimal valid map', () => {
        expect(validateWaferMap(minimalMap(), FAMILY_TYPES)).toMatchObject({ valid: true })
    })

    it('rejects text that is not JSON', () => {
        expect(validateWaferMap('{ not json', FAMILY_TYPES)).toEqual({ valid: false, errors: ['WaferTypeMap don\'t follow json format.'] })
    })

    it('rejects a map without Groups or MapGroups', () => {
        expect(validateWaferMap('{"Groups": {}}', FAMILY_TYPES).valid).toBe(false)
        expect(validateWaferMap('[]', FAMILY_TYPES).valid).toBe(false)
    })

    it('stops when no family types are known', () => {
        expect(validateWaferMap(minimalMap(), [])).toEqual({ valid: false, errors: ['No ASIC FamilyType found.'] })
    })

    it('accumulates group violations: wrong PosInGroup and unknown family type', () => {
        const text = minimalMap({
            Groups: { Group_0: [{ PosInGroup: 1, FamilyType: 'NOT_A_TYPE' }, { PosInGroup: 1, FamilyType: 'MOSAIX' }] },
        })
        const result = validateWaferMap(text, FAMILY_TYPES)
        expect(result.valid).toBe(false)
        if (!result.valid) {
            expect(result.errors).toEqual([
                'Unmatching PosInGroup index: 1 from expected 0 in group Group_0',
                'Asic Family type: NOT_A_TYPE is not part of enum value in the DB',
            ])
        }
    })

    it('stops at the first column violation', () => {
        const text = minimalMap({
            MapGroups: {
                MapGroupsRow0: {
                    MapGroupsColumns: [
                        { GroupName: 'Missing', ExistingAsics: ['All'] },
                        { GroupName: 'Group_0', ExistingAsics: ['All'] },
                    ],
                },
            },
        })
        expect(validateWaferMap(text, FAMILY_TYPES)).toEqual({
            valid: false,
            errors: ['Map Group: MapGroupsRow0 Col: 0 group name Missing was not found'],
        })
    })

    it('rejects an invalid index array, a size mismatch and a doubly classified asic', () => {
        const column = (patch: Record<string, unknown>) => minimalMap({
            MapGroups: { MapGroupsRow0: { MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [1],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: [0],
                ...patch,
            }] } },
        })
        expect(validateWaferMap(column({ ExistingAsics: ['Some'] }), FAMILY_TYPES))
            .toMatchObject({ valid: false, errors: ['Map Group: MapGroupsRow0 Col: 0 Wrong array found'] })
        expect(validateWaferMap(column({ MechanicallyIntegerASICs: [] }), FAMILY_TYPES))
            .toMatchObject({ valid: false, errors: ['Map Group: MapGroupsRow0 Col: 0, unmaching number of asics and properties size'] })
        expect(validateWaferMap(column({ MechanicallyDamagedASICs: [0], MechanicallyIntegerASICs: [0] }), FAMILY_TYPES))
            .toMatchObject({ valid: false, errors: ['Map Group: MapGroupsRow0 Col: 0, asic index 0 has more than one property'] })
    })

})

describe('resolveIndexList', () => {

    it('expands the three accepted forms and rejects the rest', () => {
        expect(resolveIndexList(undefined, 3)).toEqual([])
        expect(resolveIndexList(null, 3)).toEqual([])
        expect(resolveIndexList([], 3)).toEqual([])
        expect(resolveIndexList(['All'], 3)).toEqual([0, 1, 2])
        expect(resolveIndexList([0, 2], 3)).toEqual([0, 2])
        expect(resolveIndexList(['Some'], 3)).toBeUndefined()
        expect(resolveIndexList([0, 'x'], 3)).toBeUndefined()
        expect(resolveIndexList('All', 3)).toBeUndefined()
    })

})
