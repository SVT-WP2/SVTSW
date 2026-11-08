import { EpicWafer, EpicWaferCreateRequest, EpicWaferType, EpicWaferTypeCreateRequest } from 'svt-ts-types'

import { expectStatus } from './e2e-expectations'
import { TestSetup } from './test-setup'


/**
 * The smallest map the agent accepts: one group of two ASICs, one row, one column. A wafer of this type gets the ASICs
 * `<serial>_0_0` (MOSAIX, MechanicallyInteger) and `<serial>_0_1` (BABYMOSAIX, MechanicallyDamaged).
 */
export const SMALL_WAFER_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }, { PosInGroup: 1, FamilyType: 'BABYMOSAIX' }] },
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
})

/** A map of one group of `count` MOSAIX ASICs (`<serial>_0_0` … `<serial>_0_<count-1>`), for the default page size. */
export function waferMapOfAsics(count: number): string {
    return JSON.stringify({
        Groups: { Group_0: Array.from({ length: count }, (_, index) => ({ PosInGroup: index, FamilyType: 'MOSAIX' })) },
        MapGroups: {
            MapGroupsRow0: {
                MapGroupsColumns: [{
                    GroupName: 'Group_0',
                    ExistingAsics: ['All'],
                    MechanicallyDamagedASICs: [],
                    ASICsCoveredByGreenLayer: [],
                    MechanicallyIntegerASICs: ['All'],
                }],
            },
        },
    })
}

export const SMALL_WAFER_TYPE_CREATE: EpicWaferTypeCreateRequest = {
    name: 'Small',
    engineeringRun: 'ER1',
    foundry: 'TowerSemiconductor',
    technology: 'TPSCo65',
    waferMap: SMALL_WAFER_MAP,
}

/** A wafer location of the `wpGeneralLocation` enum. */
export const WAFER_LOCATION = 'CERN_186_R_E10'

export function waferCreate(overrides: Partial<EpicWaferCreateRequest> = {}): EpicWaferCreateRequest {
    return {
        serialNumber: 'W-1',
        batchNumber: 7,
        thinningDate: null,
        dicingDate: null,
        productionDate: null,
        waferTypeId: 1,
        generalLocation: WAFER_LOCATION,
        ...overrides,
    }
}

/** Creates a wafer type through the API (`POST /api/wafer-types`). */
export async function createWaferType(
    setup: TestSetup,
    create: EpicWaferTypeCreateRequest = SMALL_WAFER_TYPE_CREATE,
): Promise<EpicWaferType> {
    return expectStatus(await setup.post<EpicWaferType>('/api/wafer-types', create), 201)
}

/** Creates a wafer and its ASICs through the API (`POST /api/wafers`). */
export async function createWafer(setup: TestSetup, overrides: Partial<EpicWaferCreateRequest> = {}): Promise<EpicWafer> {
    return expectStatus(await setup.post<EpicWafer>('/api/wafers', waferCreate(overrides)), 201)
}
