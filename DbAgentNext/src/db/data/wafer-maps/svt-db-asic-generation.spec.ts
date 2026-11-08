// @vitest-environment node
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { generateAsics, SvtDbGeneratedAsic } from './svt-db-asic-generation'
import { SvtDbWaferMap } from './svt-db-wafer-map.models'


const MAPS_DIR = resolve(__dirname, '../../../../../Configurations/WaferTypeMappings')
const readMap = (file: string): SvtDbWaferMap => JSON.parse(readFileSync(resolve(MAPS_DIR, file), 'utf8')) as SvtDbWaferMap

type Fixture = {
    waferSerialNumber: string
    count: number
    qualityCounts: Record<string, number>
    sha256OfSortedLines: string
    samples: SvtDbGeneratedAsic[]
}

/** The same digest the fixture generator computed over the production rows. */
export function digestAsics(asics: readonly SvtDbGeneratedAsic[]): string {
    const lines = asics.map((asic) => `${asic.serialNumber}|${asic.waferMapPosition}|${asic.familyType}|${asic.quality}`).sort()
    return createHash('sha256').update(lines.join('\n')).digest('hex')
}

describe('generateAsics', () => {

    it('worked example 5.1: one die, no prefix', () => {
        expect(generateAsics('W-001', readMap('dummy_MPW1_WaferMap.json'))).toEqual([
            { serialNumber: 'W-001_0_0', waferMapPosition: '0_0', familyType: 'AncMPW1', quality: 'MechanicallyInteger' },
        ])
    })

    it('worked example 5.2: a babyMOSAIX row numbers its intact dies, damaged dies fall back', () => {
        const map: SvtDbWaferMap = {
            Groups: { Group_1: [{ PosInGroup: 0, FamilyType: 'BABYMOSAIX' }, { PosInGroup: 1, FamilyType: 'BABYMOSAIX' }] },
            MapGroups: {
                MapGroupsRow7: {
                    SN_prefix: 'babyMOSAIX-1',
                    MapGroupsColumns: [
                        {
                            GroupName: 'Group_1',
                            ExistingAsics: [0, 1],
                            MechanicallyDamagedASICs: [1],
                            ASICsCoveredByGreenLayer: [],
                            MechanicallyIntegerASICs: [0],
                        },
                        {
                            GroupName: 'Group_1',
                            ExistingAsics: ['All'],
                            MechanicallyDamagedASICs: [],
                            ASICsCoveredByGreenLayer: [],
                            MechanicallyIntegerASICs: ['All'],
                        },
                    ],
                },
            },
        }
        const die = (serialNumber: string, waferMapPosition: string, quality: SvtDbGeneratedAsic['quality']): SvtDbGeneratedAsic =>
            ({ serialNumber, waferMapPosition, familyType: 'BABYMOSAIX', quality })
        expect(generateAsics('HS01769-12A4', map)).toEqual([
            die('babyMOSAIX-1_1_HS01769-12A4', '7_0', 'MechanicallyInteger'),
            die('HS01769-12A4_7_1', '7_1', 'MechanicallyDamaged'),
            die('babyMOSAIX-1_2_HS01769-12A4', '7_2', 'MechanicallyInteger'),
            die('babyMOSAIX-1_3_HS01769-12A4', '7_3', 'MechanicallyInteger'),
        ])
    })

    it('a MOSAIX row yields <prefix>_<waferSN> and processes rows in numeric order', () => {
        const map: SvtDbWaferMap = {
            Groups: { G: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }] },
            MapGroups: {
                MapGroupsRow10: { MapGroupsColumns: [{ GroupName: 'G', ExistingAsics: ['All'], MechanicallyIntegerASICs: ['All'] }] },
                MapGroupsRow3: {
                    SN_prefix: 'MOSAIX-3',
                    MapGroupsColumns: [{ GroupName: 'G', ExistingAsics: ['All'], MechanicallyIntegerASICs: ['All'] }],
                },
            },
        }
        expect(generateAsics('W', map).map((asic) => asic.serialNumber)).toEqual(['MOSAIX-3_W', 'W_10_0'])
    })

    it('regenerates the production ASICs of an ER2 wafer exactly', () => {
        const fixture = JSON.parse(readFileSync(resolve(__dirname, '__fixtures__/er2-HS02697-24A0.asics.json'), 'utf8')) as Fixture
        const asics = generateAsics(fixture.waferSerialNumber, readMap('ER2WaferMap_v0.json'))

        expect(asics).toHaveLength(fixture.count)
        expect(digestAsics(asics)).toBe(fixture.sha256OfSortedLines)
        for (const sample of fixture.samples) {
            expect(asics.find((asic) => asic.waferMapPosition === sample.waferMapPosition)).toEqual(sample)
        }
        const qualityCounts: Record<string, number> = {}
        for (const asic of asics) {
            qualityCounts[asic.quality] = (qualityCounts[asic.quality] ?? 0) + 1
        }
        expect(qualityCounts).toEqual(fixture.qualityCounts)
    })

    it('rejects impossible states the validation would have caught', () => {
        const base: SvtDbWaferMap = {
            Groups: { G: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }] },
            MapGroups: { MapGroupsRow0: { MapGroupsColumns: [{ GroupName: 'G', ExistingAsics: ['All'] }] } },
        }
        expect(() => generateAsics('W', base)).toThrow('Wrong Asic quality property for asic 0')
        expect(() => generateAsics('W', {
            ...base,
            MapGroups: { MapGroupsRow0: { MapGroupsColumns: [{ GroupName: 'G', ExistingAsics: ['Some'] as unknown as ['All'] }] } },
        })).toThrow('Wrong array found')
        expect(() => generateAsics('W', {
            ...base,
            MapGroups: { MapGroupsRow0: { MapGroupsColumns: [{ GroupName: 'Missing', ExistingAsics: ['All'] }] } },
        })).toThrow('group name Missing was not found')
    })

})
