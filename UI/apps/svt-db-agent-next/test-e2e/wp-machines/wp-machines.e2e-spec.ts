import { SvtDbAgentKafka, SvtDbAgentKafkaWaferTypes, SvtDbAgentKafkaWafers, SvtDbAgentKafkaWpMachines } from 'epic/entities'
import { EpicWpMachine, EpicWpMachineUpdateRequest } from 'epic-api-types'

import { insertProbeCard, TestSetup, WP_MACHINE_CREATE } from '../utils'


const SMALL_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }] },
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
})

/** `WaferProbeMachineDto` of the Kafka contract: `EpicWpMachine` plus the two orientations WPAgent reads. */
type MachineWire = EpicWpMachine & { loadedWaferOrientation: string | null; installedProbeCardOrientation: string | null }

const MACHINE_1: MachineWire = {
    id: 1,
    ...WP_MACHINE_CREATE,
    loadedWaferId: null,
    loadedWaferOrientation: null,
    installedProbeCardId: null,
    installedProbeCardOrientation: null,
}
const MACHINE_2: MachineWire = { ...MACHINE_1, id: 2, name: 'MOCK', serialNumber: 'MC0000', hostName: 'mock-prober', swVersion: '26.0' }

const UPDATE: EpicWpMachineUpdateRequest = {
    hostName: 'prober.cern.ch',
    connectionType: 'LAN',
    connectionPort: 36000,
    generalLocation: 'Prague',
    software: 'VeloxCascade',
    swVersion: '27.1',
}

type ListReply = SvtDbAgentKafka.PageReplyMessageData<MachineWire>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<MachineWire>
type LoadedRow = { machineId: number; waferId: number; orientation: string | null; date: string; username: string | null; status: string }
type InstalledRow = { machineId: number; probeCardId: number; orientation: string | null; date: string; username: string | null }

describe('Wafer probe machines (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await createMachine(WP_MACHINE_CREATE)
    })

    async function send<TData>(message: { type: string; data?: unknown }): Promise<TData> {
        const reply = await setup.send<TData>(message)
        if (reply.status !== 'Success') {
            throw new Error(`${message.type} failed: ${reply.error.message}`)
        }
        return reply.data
    }

    async function createMachine(create: typeof WP_MACHINE_CREATE): Promise<MachineWire> {
        const data = await send<EntityReply>(new SvtDbAgentKafkaWpMachines.CreateWpMachineMessage({ create }))
        return data.entity
    }

    /** Wafer type 1 and wafers 1 (`W-1`) and 2 (`W-2`), through the agent. */
    async function seedWafers(): Promise<void> {
        await send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({
            create: { name: 'Small', engineeringRun: 'ER1', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: SMALL_MAP },
        }))
        for (const serialNumber of ['W-1', 'W-2']) {
            await send(new SvtDbAgentKafkaWafers.CreateWaferMessage({
                create: {
                    serialNumber, batchNumber: 1, thinningDate: null, dicingDate: null, productionDate: null,
                    waferTypeId: 1, generalLocation: 'CERN',
                },
            }))
        }
    }

    async function getAll(data: SvtDbAgentKafkaWpMachines.GetAllWpMachinesData = {}): Promise<ListReply> {
        return send<ListReply>(new SvtDbAgentKafkaWpMachines.GetAllWpMachinesMessage(data))
    }

    function loadedRows(): Promise<LoadedRow[]> {
        return setup.query<LoadedRow>(
            `select "machineId", "waferId", orientation, to_char(date, 'YYYY-MM-DD') as date, username, status
             from main."WaferLoadedInMachine" order by id`,
        )
    }

    function installedRows(): Promise<InstalledRow[]> {
        return setup.query<InstalledRow>(
            `select "machineId", "probeCardId", orientation, to_char(date, 'YYYY-MM-DD') as date, username
             from main."ProbeCardInstalledInMachine" order by id`,
        )
    }

    async function today(): Promise<string> {
        const [row] = await setup.query<{ today: string }>('select current_date::text as today')
        return row.today
    }

    async function machineRow(id: number): Promise<Record<string, unknown>> {
        const [row] = await setup.query(
            `select "loadedWaferId", "loadedWaferOrientation", "installedProbeCardId", "installedProbeCardOrientation"
             from main."WaferProbeMachine" where id = ?`,
            [id],
        )
        return row
    }

    // ── GetAllWaferProbeMachines ──────────────────────────────────

    describe('GetAllWaferProbeMachines', () => {

        it('lists the machines in id order with the contract fields, orientations included', async () => {
            await createMachine({ ...WP_MACHINE_CREATE, name: 'MOCK', serialNumber: 'MC0000', hostName: 'mock-prober', swVersion: '26.0' })

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaWpMachines.GetAllWpMachinesMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllWaferProbeMachinesReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [MACHINE_1, MACHINE_2], totalCount: 2 })
            expect(Object.keys(reply.data.items[0])).toEqual([
                'id', 'name', 'serialNumber', 'hostName', 'connectionType', 'connectionPort', 'generalLocation', 'software', 'swVersion',
                'vendor', 'loadedWaferId', 'loadedWaferOrientation', 'installedProbeCardId', 'installedProbeCardOrientation',
            ])
        })

        it('filters by ids (an empty list means all) and rejects an unknown filter key', async () => {
            await createMachine({ ...WP_MACHINE_CREATE, name: 'MOCK', serialNumber: 'MC0000' })

            expect((await getAll({ filter: { ids: [2] } })).items.map((item) => item.id)).toEqual([2])
            expect((await getAll({ filter: { ids: [] } })).totalCount).toBe(2)
            expect((await getAll({ filter: { ids: [999] } })).items).toEqual([])
            const unknown = await setup.send({ type: 'GetAllWaferProbeMachines', data: { filter: { name: 'WPMIT' } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: name is not an allowed filter.' } })
        })

    })

    // ── CreateWaferProbeMachine ───────────────────────────────────

    describe('CreateWaferProbeMachine', () => {

        it('creates the machine with nothing loaded or installed', async () => {
            await setup.clearDatabase()

            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWpMachines.CreateWpMachineMessage({ create: WP_MACHINE_CREATE }))

            expect(reply).toMatchObject({ type: 'CreateWaferProbeMachineReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: MACHINE_1 })
            const rows = await setup.query(
                'select name, "serialNumber", "hostName", "connectionType", "connectionPort" from main."WaferProbeMachine"',
            )
            expect(rows).toEqual([
                { name: 'WPMIT', serialNumber: 'TS3500SE', hostName: 'cern.ch', connectionType: 'TCPIP', connectionPort: 35555 },
            ])
        })

        it('rejects unknown enum values, a duplicate name or serial number, an unknown key and a missing create', async () => {
            const fresh = { ...WP_MACHINE_CREATE, name: 'MOCK', serialNumber: 'MC0000' }
            const cases: [Record<string, unknown> | undefined, string][] = [
                [{ ...fresh, connectionType: 'Carrier pigeon' }, 'Carrier pigeon is not a value of the wpConnectionType enum'],
                [{ ...fresh, generalLocation: 'Moon' }, 'Moon is not a value of the wpGeneralLocation enum'],
                [{ ...fresh, software: 'Excel' }, 'Excel is not a value of the wpSwType enum'],
                [{ ...fresh, vendor: 'ACME' }, 'ACME is not a value of the wpVendor enum'],
                [{ ...fresh, name: 'WPMIT' }, 'already exists'],
                [{ ...fresh, serialNumber: 'TS3500SE' }, 'already exists'],
                [{ ...fresh, colour: 'blue' }, 'colour'],
                [undefined, 'data.create'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateWaferProbeMachine', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."WaferProbeMachine"')).toEqual([{ n: 1 }])
        })

    })

    // ── UpdateWaferProbeMachine ───────────────────────────────────

    describe('UpdateWaferProbeMachine', () => {

        it('updates the six updatable fields, generalLocation included (no location history for machines)', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWpMachines.UpdateWpMachineMessage({ id: 1, update: UPDATE }))

            expect(reply).toMatchObject({ type: 'UpdateWaferProbeMachineReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...MACHINE_1, ...UPDATE } })
            expect((await getAll()).items).toEqual([{ ...MACHINE_1, ...UPDATE }])
        })

        it('answers NotFound for an unknown machine, BadRequest for a missing field, a bad enum value or a foreign key', async () => {
            const notFound = await setup.send(new SvtDbAgentKafkaWpMachines.UpdateWpMachineMessage({ id: 999, update: UPDATE }))
            const missing = await setup.send({ type: 'UpdateWaferProbeMachine', data: { id: 1, update: { hostName: 'x' } } })
            const badEnum = await setup.send({ type: 'UpdateWaferProbeMachine', data: { id: 1, update: { ...UPDATE, software: 'Excel' } } })
            const renamed = await setup.send({ type: 'UpdateWaferProbeMachine', data: { id: 1, update: { ...UPDATE, name: 'Other' } } })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { message: 'Wafer probe machine 999 not found' } })
            expect(missing.status).toBe('BadRequest')
            expect(missing.error.message).toContain('connectionType')
            expect(badEnum).toMatchObject({ status: 'BadRequest', error: { message: 'Excel is not a value of the wpSwType enum' } })
            expect(renamed.status).toBe('BadRequest')
            expect(renamed.error.message).toContain('name')
            expect((await getAll()).items).toEqual([MACHINE_1])
        })

    })

    // ── UpdateWpMachineLoadedWafer ────────────────────────────────

    describe('UpdateWpMachineLoadedWafer', () => {

        beforeEach(() => seedWafers())

        function setLoadedWafer(data: unknown) {
            return setup.send<EntityReply>({ type: 'UpdateWpMachineLoadedWafer', data })
        }

        it('loads a wafer: machine columns set and a Loaded history row written', async () => {
            const reply = await setLoadedWafer({ wpMachineId: 1, loadedWaferId: 1, loadedWaferOrientation: 'West' })

            expect(reply).toMatchObject({ type: 'UpdateWpMachineLoadedWaferReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...MACHINE_1, loadedWaferId: 1, loadedWaferOrientation: 'West' } })
            expect(await machineRow(1)).toEqual({
                loadedWaferId: 1, loadedWaferOrientation: 'West', installedProbeCardId: null, installedProbeCardOrientation: null,
            })
            expect(await loadedRows()).toEqual([
                { machineId: 1, waferId: 1, orientation: 'West', date: await today(), username: null, status: 'Loaded' },
            ])
        })

        it('swaps wafers: one Loaded row for the new wafer and no Unloaded row for the previous one (X-8, Q13)', async () => {
            await setLoadedWafer({ wpMachineId: 1, loadedWaferId: 1, loadedWaferOrientation: 'West' })

            const reply = await setLoadedWafer({ wpMachineId: 1, loadedWaferId: 2, loadedWaferOrientation: 'East' })

            expect(reply.data.entity).toMatchObject({ loadedWaferId: 2, loadedWaferOrientation: 'East' })
            expect((await loadedRows()).map((row) => [row.waferId, row.status, row.orientation])).toEqual([
                [1, 'Loaded', 'West'],
                [2, 'Loaded', 'East'],
            ])
        })

        it('unloads with null: machine columns cleared and an Unloaded row written', async () => {
            await setLoadedWafer({ wpMachineId: 1, loadedWaferId: 1, loadedWaferOrientation: 'North' })

            const reply = await setLoadedWafer({ wpMachineId: 1, loadedWaferId: null, loadedWaferOrientation: null })

            expect(reply.status).toBe('Success')
            expect(reply.data.entity).toMatchObject({ loadedWaferId: null, loadedWaferOrientation: null })
            expect(await machineRow(1)).toMatchObject({ loadedWaferId: null, loadedWaferOrientation: null })
            expect((await loadedRows()).map((row) => [row.waferId, row.status])).toEqual([[1, 'Loaded'], [1, 'Unloaded']])
        })

        it('rejects an unload with nothing loaded, a load without orientation, an unknown wafer, orientation or machine', async () => {
            const cases: [Record<string, unknown>, string, string][] = [
                [{ wpMachineId: 1, loadedWaferId: null }, 'BadRequest', 'No wafer is loaded in wafer probe machine 1'],
                [{ wpMachineId: 1, loadedWaferId: 1 }, 'BadRequest', 'data.loadedWaferOrientation is required to load a wafer'],
                [{ wpMachineId: 1, loadedWaferId: 999, loadedWaferOrientation: 'West' }, 'BadRequest', 'Wafer 999 does not exist'],
                [{ wpMachineId: 1, loadedWaferId: 1, loadedWaferOrientation: 'Up' }, 'BadRequest', 'Up is not a value of the'],
                [{ wpMachineId: 999, loadedWaferId: 1, loadedWaferOrientation: 'West' }, 'NotFound', 'Wafer probe machine 999 not found'],
                [{ wpMachineId: 'one', loadedWaferId: 1 }, 'BadRequest', 'wpMachineId'],
            ]
            for (const [data, status, message] of cases) {
                const reply = await setLoadedWafer(data)
                expect(reply.status, message).toBe(status)
                expect(reply.error.message).toContain(message)
            }
            expect(await loadedRows()).toEqual([])
            expect(await machineRow(1)).toMatchObject({ loadedWaferId: null })
        })

    })

    // ── UpdateWpMachineInstalledProbeCard ─────────────────────────

    describe('UpdateWpMachineInstalledProbeCard', () => {

        beforeEach(async () => {
            await insertProbeCard(setup, { serialNumber: 'MVP251669H', name: 'NKF7_MPI' })
            await insertProbeCard(setup, { serialNumber: 'MVP255241H', name: 'MOSAIX_LEC' })
        })

        function setInstalledProbeCard(data: unknown) {
            return setup.send<EntityReply>({ type: 'UpdateWpMachineInstalledProbeCard', data })
        }

        it('installs a probe card: machine columns set and a history row written', async () => {
            const reply = await setInstalledProbeCard({ wpMachineId: 1, installedProbeCardId: 2, installedProbeCardOrientation: 'West' })

            expect(reply).toMatchObject({ type: 'UpdateWpMachineInstalledProbeCardReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...MACHINE_1, installedProbeCardId: 2, installedProbeCardOrientation: 'West' } })
            expect(await installedRows()).toEqual([
                { machineId: 1, probeCardId: 2, orientation: 'West', date: await today(), username: null },
            ])
        })

        it('accepts a missing orientation and records every install', async () => {
            await setInstalledProbeCard({ wpMachineId: 1, installedProbeCardId: 1, installedProbeCardOrientation: null })
            const reply = await setInstalledProbeCard({ wpMachineId: 1, installedProbeCardId: 2, installedProbeCardOrientation: 'East' })

            expect(reply.data.entity).toMatchObject({ installedProbeCardId: 2, installedProbeCardOrientation: 'East' })
            expect((await installedRows()).map((row) => [row.probeCardId, row.orientation])).toEqual([[1, null], [2, 'East']])
        })

        it('uninstalls with null: machine columns cleared, history unchanged (D-13: the table cannot record it)', async () => {
            await setInstalledProbeCard({ wpMachineId: 1, installedProbeCardId: 1, installedProbeCardOrientation: 'West' })

            const reply = await setInstalledProbeCard({ wpMachineId: 1, installedProbeCardId: null, installedProbeCardOrientation: null })

            expect(reply.status, reply.error.message).toBe('Success')
            expect(reply.data.entity).toMatchObject({ installedProbeCardId: null, installedProbeCardOrientation: null })
            expect(await machineRow(1)).toMatchObject({ installedProbeCardId: null, installedProbeCardOrientation: null })
            expect((await installedRows()).map((row) => row.probeCardId)).toEqual([1])
        })

        it('rejects an unknown probe card or orientation and an unknown machine', async () => {
            const cases: [Record<string, unknown>, string, string][] = [
                [{ wpMachineId: 1, installedProbeCardId: 999 }, 'BadRequest', 'Probe card 999 does not exist'],
                [{ wpMachineId: 1, installedProbeCardId: 1, installedProbeCardOrientation: 'Up' }, 'BadRequest', 'Up is not a value'],
                [{ wpMachineId: 999, installedProbeCardId: 1 }, 'NotFound', 'Wafer probe machine 999 not found'],
            ]
            for (const [data, status, message] of cases) {
                const reply = await setInstalledProbeCard(data)
                expect(reply.status, message).toBe(status)
                expect(reply.error.message).toContain(message)
            }
            expect(await installedRows()).toEqual([])
        })

    })

})
