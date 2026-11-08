import { EpicWpMachineCreateRequest } from 'epic-api-types'

import { TestSetup } from './test-setup'


/** The dev database's machine `WPMIT`, as `CreateWaferProbeMachine` takes it. */
export const WP_MACHINE_CREATE: EpicWpMachineCreateRequest = {
    name: 'WPMIT',
    serialNumber: 'TS3500SE',
    hostName: 'cern.ch',
    connectionType: 'TCPIP',
    connectionPort: 35555,
    generalLocation: 'CERN',
    software: 'Sentio',
    swVersion: '25.5',
    vendor: 'MPI',
}

export type ProbeCardSeed = {
    serialNumber: string
    /** `pcName` enum value; unique. */
    name: string
    asicFamilyTypes?: string[]
}

/**
 * Inserts a probe card (and its `ProbeCardFamilyType` rows) straight into the database: the contract has no
 * message to create one. The other columns are the dev database's `NKF7_MPI` card.
 */
export async function insertProbeCard(setup: TestSetup, seed: ProbeCardSeed): Promise<number> {
    const [row] = await setup.query<{ id: number }>(
        `insert into main."ProbeCard"
            ("serialNumber", vendor, name, model, version, "arriveDate", location, type, "vendorCleaningInterval")
         values (?, 'MPI', ?, 'NKF7-TS3500-CABLEOUT-MLO(EVS-P)', 2, '2025-06-06', 'CERN', 'Vertical', 200)
         returning id`,
        [seed.serialNumber, seed.name],
    )
    for (const familyType of seed.asicFamilyTypes ?? []) {
        await setup.query('insert into main."ProbeCardFamilyType" ("probeCardId", "asicFamilyType") values (?, ?)', [row.id, familyType])
    }
    return row.id
}
