import { EpicWpMachine, EpicWpMachineUpdateRequest, EpicWpProbeCard, EpicWpProject, EpicWpProjectCreateRequest } from 'svt-ts-types'

import {
    createWafer,
    createWaferType,
    expectError,
    expectStatus,
    insertProbeCard,
    TestSetup,
    WP_MACHINE_CREATE,
} from '../utils'


const MACHINE_1: EpicWpMachine = {
    id: 1,
    ...WP_MACHINE_CREATE,
    loadedWaferId: null,
    loadedWaferOrientation: null,
    installedProbeCardId: null,
    installedProbeCardOrientation: null,
}
const MACHINE_2: EpicWpMachine = {
    ...MACHINE_1,
    id: 2,
    name: 'MOCK',
    serialNumber: 'MC0000',
    hostName: 'mock-prober',
    swVersion: '26.0',
}

const UPDATE: EpicWpMachineUpdateRequest = {
    hostName: 'prober.cern.ch',
    connectionType: 'LAN',
    connectionPort: 36000,
    generalLocation: 'Prague',
    software: 'VeloxCascade',
    swVersion: '27.1',
}

/** A probe card as the BFF answers it: `EpicWpProbeCard` plus the agent's `asicFamilyTypes` (finding E2E-6). */
type WpProbeCardResponse = EpicWpProbeCard & { asicFamilyTypes: string[] }

const CARD_1: WpProbeCardResponse = {
    id: 1,
    serialNumber: 'MVP251669H',
    name: 'NKF7_MPI',
    vendor: 'MPI',
    model: 'NKF7-TS3500-CABLEOUT-MLO(EVS-P)',
    arriveDate: '2025-06-06',
    location: 'CERN',
    type: 'Vertical',
    vendorCleaningInterval: 200,
    asicFamilyTypes: ['NKF7'],
}
/** Family types come back in the enum's order (MOSAIX precedes BABYMOSAIX there), not the insert order. */
const CARD_2: WpProbeCardResponse = {
    ...CARD_1,
    id: 2,
    serialNumber: 'MVP255241H',
    name: 'MOSAIX_LEC',
    asicFamilyTypes: ['MOSAIX', 'BABYMOSAIX'],
}

const PROJECT_CREATE: EpicWpProjectCreateRequest = {
    wpMachineId: 1,
    waferTypeId: 1,
    name: 'NKF7_Test_2025_E',
    asicFamilyType: 'NKF7',
    orientation: 'East',
    alignmentDie: '2,2',
    homeDie: '5,2',
    local2GlobalMap: JSON.stringify([{ chip_name: 'NKF7', global_coordinates: { column: 6, row: 1 } }], null, 4),
}
const PROJECT_1: EpicWpProject = { id: 1, ...PROJECT_CREATE }

describe('Wafer probing (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        expectStatus(await setup.post('/api/wp-machines', WP_MACHINE_CREATE), 201)
    })

    function machineRow(): Promise<Record<string, unknown>[]> {
        return setup.query(
            `select "loadedWaferId", "loadedWaferOrientation", "installedProbeCardId", "installedProbeCardOrientation"
             from main."WaferProbeMachine" where id = 1`,
        )
    }

    // ── /api/wp-machines ──────────────────────────────────────────

    describe('GET /api/wp-machines', () => {

        it('lists the machines in id order as a plain array', async () => {
            expectStatus(await setup.post('/api/wp-machines', {
                ...WP_MACHINE_CREATE,
                name: 'MOCK',
                serialNumber: 'MC0000',
                hostName: 'mock-prober',
                swVersion: '26.0',
            }), 201)

            const machines = expectStatus(await setup.get<EpicWpMachine[]>('/api/wp-machines'), 200)

            expect(machines).toEqual([MACHINE_1, MACHINE_2])
            expect(Object.keys(machines[0])).toEqual([
                'id', 'name', 'serialNumber', 'hostName', 'connectionType', 'connectionPort', 'generalLocation', 'software', 'swVersion',
                'vendor', 'loadedWaferId', 'loadedWaferOrientation', 'installedProbeCardId', 'installedProbeCardOrientation',
            ])
        })

    })

    describe('GET /api/wp-machines/:id', () => {

        it('returns the one machine; 404 for an unknown one, 400 for an id that is no number', async () => {
            expect(await setup.get('/api/wp-machines/1')).toEqual({ status: 200, body: MACHINE_1 })
            expectError(await setup.get('/api/wp-machines/999'), 404, 'WpMachine does not exist: 999')
            expectError(await setup.get('/api/wp-machines/one'), 400, 'numeric string is expected')
        })

    })

    describe('POST /api/wp-machines', () => {

        it('creates the machine with nothing loaded or installed', async () => {
            await setup.clearDatabase()

            const response = await setup.post('/api/wp-machines', WP_MACHINE_CREATE)

            expect(response).toEqual({ status: 201, body: MACHINE_1 })
            expect(await setup.query('select name, "serialNumber", "connectionPort" from main."WaferProbeMachine"'))
                .toEqual([{ name: 'WPMIT', serialNumber: 'TS3500SE', connectionPort: 35555 }])
        })

        it('validates the body: every member required with its type (BFF)', async () => {
            expectError(
                await setup.post('/api/wp-machines', {}), 400,
                'name must be a string', 'serialNumber must be a string', 'hostName must be a string', 'connectionType must be a string',
                'connectionPort must be a number', 'generalLocation must be a string', 'software must be a string',
                'swVersion must be a string', 'vendor must be a string',
            )
        })

        it('maps the agent\'s rejections to 400: enum values, duplicate name or serial; writes nothing', async () => {
            const fresh = { ...WP_MACHINE_CREATE, name: 'MOCK', serialNumber: 'MC0000' }

            expectError(
                await setup.post('/api/wp-machines', { ...fresh, connectionType: 'Pigeon' }), 400,
                'Pigeon is not a value of the wpConnectionType enum',
            )
            expectError(
                await setup.post('/api/wp-machines', { ...fresh, generalLocation: 'Moon' }), 400,
                'Moon is not a value of the wpGeneralLocation enum',
            )
            expectError(
                await setup.post('/api/wp-machines', { ...fresh, software: 'Excel' }), 400,
                'Excel is not a value of the wpSwType enum',
            )
            expectError(await setup.post('/api/wp-machines', { ...fresh, vendor: 'ACME' }), 400, 'ACME is not a value of the wpVendor enum')
            expectError(await setup.post('/api/wp-machines', { ...fresh, name: 'WPMIT' }), 400, 'already exists')
            expectError(await setup.post('/api/wp-machines', { ...fresh, serialNumber: 'TS3500SE' }), 400, 'already exists')
            expect(await setup.count('WaferProbeMachine')).toBe(1)
        })

    })

    describe('PATCH /api/wp-machines/:id', () => {

        it('updates the six updatable members: 200 with the machine', async () => {
            const response = await setup.patch('/api/wp-machines/1', UPDATE)

            expect(response).toEqual({ status: 200, body: { ...MACHINE_1, ...UPDATE } })
            expect((await setup.get('/api/wp-machines')).body).toEqual([{ ...MACHINE_1, ...UPDATE }])
        })

        it('drops name and serialNumber (not updatable) instead of forwarding them', async () => {
            const response = await setup.patch('/api/wp-machines/1', { ...UPDATE, name: 'Other', serialNumber: 'X' })

            expect(response).toEqual({ status: 200, body: { ...MACHINE_1, ...UPDATE } })
        })

        it('answers 404 for an unknown machine, 400 for a partial body (BFF) or a bad enum value (agent)', async () => {
            expectError(await setup.patch('/api/wp-machines/999', UPDATE), 404, 'Wafer probe machine 999 not found')
            expectError(await setup.patch('/api/wp-machines/1', { hostName: 'x' }), 400, 'connectionType must be a string')
            expectError(
                await setup.patch('/api/wp-machines/1', { ...UPDATE, software: 'Excel' }), 400,
                'Excel is not a value of the wpSwType enum',
            )
            expect((await setup.get('/api/wp-machines/1')).body).toEqual(MACHINE_1)
        })

    })

    describe('POST /api/wp-machines/:id/loaded-wafer', () => {

        type LoadedRow = { machineId: number; waferId: number; orientation: string | null; status: string }

        /** Wafers 1 (`W-1`) and 2 (`W-2`). */
        beforeEach(async () => {
            await createWaferType(setup)
            await createWafer(setup)
            await createWafer(setup, { serialNumber: 'W-2' })
        })

        function loadedRows(): Promise<LoadedRow[]> {
            return setup.query<LoadedRow>('select "machineId", "waferId", orientation, status from main."WaferLoadedInMachine" order by id')
        }

        function load(loadedWaferId: number | null, loadedWaferOrientation?: string | null, machineId: number | string = 1) {
            return setup.post(`/api/wp-machines/${machineId}/loaded-wafer`, { loadedWaferId, loadedWaferOrientation })
        }

        it('loads a wafer in an orientation: 201 with the machine, its columns set and a Loaded row written', async () => {
            const loaded = { ...MACHINE_1, loadedWaferId: 1, loadedWaferOrientation: 'West' }

            const response = await load(1, 'West')

            expect(response).toEqual({ status: 201, body: loaded })
            expect(await machineRow()).toEqual([
                { loadedWaferId: 1, loadedWaferOrientation: 'West', installedProbeCardId: null, installedProbeCardOrientation: null },
            ])
            expect(await loadedRows()).toEqual([{ machineId: 1, waferId: 1, orientation: 'West', status: 'Loaded' }])
            expect((await setup.get('/api/wp-machines/1')).body).toEqual(loaded)
        })

        it('re-orients the loaded wafer when it is sent again with another orientation', async () => {
            await load(1, 'West')

            const response = await load(1, 'North')

            expect(response.body).toMatchObject({ loadedWaferId: 1, loadedWaferOrientation: 'North' })
            expect((await loadedRows()).map((row) => row.orientation)).toEqual(['West', 'North'])
        })

        it('swaps wafers: one Loaded row for the new wafer, no Unloaded row for the previous one (as the C++)', async () => {
            await load(1, 'West')

            const response = await load(2, 'East')

            expect(response.body).toMatchObject({ loadedWaferId: 2, loadedWaferOrientation: 'East' })
            expect(await loadedRows()).toEqual([
                { machineId: 1, waferId: 1, orientation: 'West', status: 'Loaded' },
                { machineId: 1, waferId: 2, orientation: 'East', status: 'Loaded' },
            ])
        })

        it('answers 400 for a load without an orientation or with one outside waferMapOrientation, writing nothing', async () => {
            const required = 'loadedWaferOrientation is required to load a wafer'

            expectError(await load(1), 400, required)
            expectError(await load(1, null), 400, required)
            // an empty string is no missing value to the agent: its enum check rejects it
            expectError(await load(1, ''), 400, 'is not a value of the waferMapOrientation enum')
            expectError(await load(1, 'Up'), 400, 'Up is not a value of the waferMapOrientation enum')
            expect(await loadedRows()).toEqual([])
            expect(await machineRow()).toEqual([
                { loadedWaferId: null, loadedWaferOrientation: null, installedProbeCardId: null, installedProbeCardOrientation: null },
            ])
        })

        it('unloads with null: 201, both columns cleared and an Unloaded row; an orientation sent is ignored', async () => {
            await load(1, 'West')

            const response = await load(null, 'East')

            expect(response).toEqual({ status: 201, body: MACHINE_1 })
            expect(await machineRow()).toEqual([
                { loadedWaferId: null, loadedWaferOrientation: null, installedProbeCardId: null, installedProbeCardOrientation: null },
            ])
            expect(await loadedRows()).toEqual([
                { machineId: 1, waferId: 1, orientation: 'West', status: 'Loaded' },
                { machineId: 1, waferId: 1, orientation: null, status: 'Unloaded' },
            ])
        })

        it('answers 404 for an unknown machine; 400 for an unload of nothing, an unknown wafer, ids that are no numbers', async () => {
            expectError(await load(1, 'West', 999), 404, 'Wafer probe machine 999 not found')
            expectError(await load(null), 400, 'No wafer is loaded in wafer probe machine 1')
            expectError(await load(999, 'West'), 400, 'Wafer 999 does not exist')
            expectError(
                await setup.post('/api/wp-machines/1/loaded-wafer', { loadedWaferId: 'one', loadedWaferOrientation: 'West' }), 400,
                'loadedWaferId must be a number',
            )
            expectError(await load(null, null, 'one'), 400, 'numeric string is expected')
        })

    })

    describe('POST /api/wp-machines/:id/installed-probe-card', () => {

        beforeEach(async () => {
            await insertProbeCard(setup, { serialNumber: CARD_1.serialNumber, name: CARD_1.name, asicFamilyTypes: ['NKF7'] })
            await insertProbeCard(setup, {
                serialNumber: CARD_2.serialNumber,
                name: CARD_2.name,
                asicFamilyTypes: ['BABYMOSAIX', 'MOSAIX'],
            })
        })

        it('installs a probe card in an orientation: 201 with the machine, both columns set and a history row', async () => {
            const body = { installedProbeCardId: 2, installedProbeCardOrientation: 'West' }

            const response = await setup.post('/api/wp-machines/1/installed-probe-card', body)

            expect(response).toEqual({ status: 201, body: { ...MACHINE_1, ...body } })
            expect(await machineRow()).toEqual([{ loadedWaferId: null, loadedWaferOrientation: null, ...body }])
            expect(await setup.query('select "machineId", "probeCardId", orientation from main."ProbeCardInstalledInMachine"'))
                .toEqual([{ machineId: 1, probeCardId: 2, orientation: 'West' }])
        })

        it('installs a probe card without orientation (optional there)', async () => {
            const response = await setup.post('/api/wp-machines/1/installed-probe-card', { installedProbeCardId: 2 })

            expect(response).toEqual({ status: 201, body: { ...MACHINE_1, installedProbeCardId: 2 } })
            expect(await setup.query('select "machineId", "probeCardId", orientation from main."ProbeCardInstalledInMachine"'))
                .toEqual([{ machineId: 1, probeCardId: 2, orientation: null }])
        })

        it('uninstalls with null (or without the member): the machine columns cleared', async () => {
            await setup.post('/api/wp-machines/1/installed-probe-card', { installedProbeCardId: 1 })

            expect(await setup.post('/api/wp-machines/1/installed-probe-card', { installedProbeCardId: null }))
                .toEqual({ status: 201, body: MACHINE_1 })
            await setup.post('/api/wp-machines/1/installed-probe-card', { installedProbeCardId: 1 })
            expect(await setup.post('/api/wp-machines/1/installed-probe-card', {})).toEqual({ status: 201, body: MACHINE_1 })
        })

        it('answers 404 for an unknown machine and 400 for an unknown probe card or an id that is no number', async () => {
            expectError(
                await setup.post('/api/wp-machines/999/installed-probe-card', { installedProbeCardId: 1 }), 404,
                'Wafer probe machine 999 not found',
            )
            expectError(await setup.post('/api/wp-machines/1/installed-probe-card', { installedProbeCardId: 999 }), 400, '999')
            const badOrientation = { installedProbeCardId: 1, installedProbeCardOrientation: 'Up' }
            expectError(
                await setup.post('/api/wp-machines/1/installed-probe-card', badOrientation), 400,
                'Up is not a value of the waferMapOrientation enum',
            )
            expectError(
                await setup.post('/api/wp-machines/1/installed-probe-card', { installedProbeCardId: 'one' }), 400,
                'installedProbeCardId must be a number',
            )
            expect(await machineRow()).toEqual([
                { loadedWaferId: null, loadedWaferOrientation: null, installedProbeCardId: null, installedProbeCardOrientation: null },
            ])
        })

    })

    // ── /api/wp-probe-cards ───────────────────────────────────────

    describe('GET /api/wp-probe-cards', () => {

        it('lists the probe cards in id order with their family types and the date as YYYY-MM-DD', async () => {
            expect(expectStatus(await setup.get('/api/wp-probe-cards'), 200)).toEqual([])
            await insertProbeCard(setup, { serialNumber: CARD_1.serialNumber, name: CARD_1.name, asicFamilyTypes: ['NKF7'] })
            await insertProbeCard(setup, {
                serialNumber: CARD_2.serialNumber,
                name: CARD_2.name,
                asicFamilyTypes: ['BABYMOSAIX', 'MOSAIX'],
            })

            const cards = expectStatus(await setup.get<WpProbeCardResponse[]>('/api/wp-probe-cards'), 200)

            expect(cards).toEqual([CARD_1, CARD_2])
            expect(Object.keys(cards[0])).toEqual([
                'id',
                'serialNumber',
                'name',
                'vendor',
                'model',
                'arriveDate',
                'location',
                'type',
                'vendorCleaningInterval',
                'asicFamilyTypes',
            ])
        })

    })

    describe('GET /api/wp-probe-cards/:id', () => {

        it('returns the one probe card; 404 for an unknown one, 400 for an id that is no number', async () => {
            await insertProbeCard(setup, { serialNumber: CARD_1.serialNumber, name: CARD_1.name, asicFamilyTypes: ['NKF7'] })
            await insertProbeCard(setup, {
                serialNumber: CARD_2.serialNumber,
                name: CARD_2.name,
                asicFamilyTypes: ['BABYMOSAIX', 'MOSAIX'],
            })

            expect(await setup.get('/api/wp-probe-cards/2')).toEqual({ status: 200, body: CARD_2 })
            expectError(await setup.get('/api/wp-probe-cards/999'), 404, 'WpProbeCard does not exist: 999')
            expectError(await setup.get('/api/wp-probe-cards/one'), 400, 'numeric string is expected')
        })

    })

    // ── /api/wp-projects ──────────────────────────────────────────

    describe('/api/wp-projects', () => {

        beforeEach(() => createWaferType(setup, {
            name: 'NKF7',
            engineeringRun: 'ER1',
            foundry: 'TowerSemiconductor',
            technology: 'TPSCo65',
            waferMap: JSON.stringify({
                Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'NKF7' }] },
                MapGroups: {
                    MapGroupsRow0: {
                        MapGroupsColumns: [{
                            GroupName: 'Group_0',
                            ExistingAsics: ['All'],
                            MechanicallyDamagedASICs: [],
                            ASICsCoveredByGreenLayer: [],
                            MechanicallyIntegerASICs: [0],
                        }],
                    },
                },
            }),
        }))

        it('GET lists the projects in id order with the map as a JSON string', async () => {
            expect(expectStatus(await setup.get('/api/wp-projects'), 200)).toEqual([])
            expectStatus(await setup.post('/api/wp-projects', PROJECT_CREATE), 201)
            expectStatus(await setup.post('/api/wp-projects', { ...PROJECT_CREATE, name: 'NKF7_Test_2025_W', orientation: 'West' }), 201)

            const projects = expectStatus(await setup.get<EpicWpProject[]>('/api/wp-projects'), 200)

            expect(projects).toEqual([PROJECT_1, { ...PROJECT_1, id: 2, name: 'NKF7_Test_2025_W', orientation: 'West' }])
            expect(Object.keys(projects[0])).toEqual([
                'id', 'wpMachineId', 'waferTypeId', 'name', 'asicFamilyType', 'orientation', 'alignmentDie', 'homeDie', 'local2GlobalMap',
            ])
        })

        it('GET /:id returns the one project; 404 for an unknown one, 400 for an id that is no number', async () => {
            expectStatus(await setup.post('/api/wp-projects', PROJECT_CREATE), 201)

            expect(await setup.get('/api/wp-projects/1')).toEqual({ status: 200, body: PROJECT_1 })
            expectError(await setup.get('/api/wp-projects/999'), 404, 'WpProject does not exist: 999')
            expectError(await setup.get('/api/wp-projects/one'), 400, 'numeric string is expected')
        })

        it('POST creates the project: 201 with it, the map stored as JSON byte for byte', async () => {
            const response = await setup.post('/api/wp-projects', PROJECT_CREATE)

            expect(response).toEqual({ status: 201, body: PROJECT_1 })
            expect(await setup.query(
                'select "wpMachineId", "waferTypeId", name, "local2GlobalMap"::text as map from main."WaferProbeProject"',
            ))
                .toEqual([{ wpMachineId: 1, waferTypeId: 1, name: PROJECT_CREATE.name, map: PROJECT_CREATE.local2GlobalMap }])
        })

        it('POST validates the body (BFF) and maps the agent\'s rejections to 400; writes nothing', async () => {
            const fresh = { ...PROJECT_CREATE, name: 'Other' }

            expectError(await setup.post('/api/wp-projects', {}), 400, 'wpMachineId must be a number', 'local2GlobalMap must be a string')
            expectError(await setup.post('/api/wp-projects', { ...fresh, wpMachineId: 999 }), 400, 'Wafer probe machine 999 does not exist')
            expectError(await setup.post('/api/wp-projects', { ...fresh, waferTypeId: 999 }), 400, 'Wafer type 999 does not exist')
            expectError(
                await setup.post('/api/wp-projects', { ...fresh, asicFamilyType: 'NOT_A_TYPE' }), 400,
                'NOT_A_TYPE is not a value of the asicFamilyType enum',
            )
            expectError(
                await setup.post('/api/wp-projects', { ...fresh, orientation: 'Up' }), 400,
                'Up is not a value of the waferMapOrientation enum',
            )
            expectError(
                await setup.post('/api/wp-projects', { ...fresh, local2GlobalMap: '{not json' }), 400,
                'must be a string holding valid JSON',
            )
            expect(await setup.count('WaferProbeProject')).toBe(0)
        })

    })

})
