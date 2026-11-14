import { EpicWpProject, EpicWpProjectCreateRequest } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWaferTypes, SvtDbAgentKafkaWpMachines, SvtDbAgentKafkaWpProjects } from 'svt-ts-types/kafka'

import { TestSetup, WP_MACHINE_CREATE } from '../utils'


const SMALL_MAP = JSON.stringify({
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
})

/** The dev database's first project, map shortened. */
const LOCAL_2_GLOBAL = [
    { chip_name: 'NKF7 (cut)', global_coordinates: { column: 6, row: 0 } },
    { chip_name: 'NKF7', global_coordinates: { column: 6, row: 1 } },
]

const CREATE: EpicWpProjectCreateRequest = {
    wpMachineId: 1,
    waferTypeId: 1,
    name: 'NKF7_Test_2025_E',
    asicFamilyType: 'NKF7',
    orientation: 'East',
    alignmentDie: '2,2',
    homeDie: '5,2',
    local2GlobalMap: JSON.stringify(LOCAL_2_GLOBAL, null, 4),
}

/** The reply re-serialises the stored JSON: same document, compact form. */
const PROJECT_1: EpicWpProject = { id: 1, ...CREATE, local2GlobalMap: JSON.stringify(LOCAL_2_GLOBAL) }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicWpProject>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWpProject>

describe('Wafer probe projects (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await send(new SvtDbAgentKafkaWpMachines.CreateWpMachineMessage({ create: WP_MACHINE_CREATE }))
        await send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({
            create: { name: 'NKF7', engineeringRun: 'ER1', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: SMALL_MAP },
        }))
    })

    async function send(message: { type: string; data?: unknown }): Promise<void> {
        const reply = await setup.send(message)
        if (reply.status !== 'Success') {
            throw new Error(`${message.type} failed: ${reply.error.message}`)
        }
    }

    async function createProject(create: EpicWpProjectCreateRequest): Promise<EpicWpProject> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWpProjects.CreateWpProjectMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaWpProjects.GetAllWpProjectsData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaWpProjects.GetAllWpProjectsMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    // ── GetAllWaferProbeProjects ──────────────────────────────────

    describe('GetAllWaferProbeProjects', () => {

        it('lists the projects in id order with the map as a JSON string', async () => {
            await createProject(CREATE)
            await createProject({ ...CREATE, name: 'NKF7_Test_2025_W', orientation: 'West' })

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaWpProjects.GetAllWpProjectsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllWaferProbeProjectsReply', status: 'Success' })
            expect(reply.data).toEqual({
                items: [PROJECT_1, { ...PROJECT_1, id: 2, name: 'NKF7_Test_2025_W', orientation: 'West' }],
                totalCount: 2,
            })
            expect(Object.keys(reply.data.items[0])).toEqual([
                'id', 'wpMachineId', 'waferTypeId', 'name', 'asicFamilyType', 'orientation', 'alignmentDie', 'homeDie', 'local2GlobalMap',
            ])
        })

        it('filters by ids (an empty list means all) and rejects an unknown filter key', async () => {
            await createProject(CREATE)

            expect(await getAll({ filter: { ids: [1] } })).toEqual({ items: [PROJECT_1], totalCount: 1 })
            expect(await getAll({ filter: { ids: [] } })).toEqual({ items: [PROJECT_1], totalCount: 1 })
            expect(await getAll({ filter: { ids: [999] } })).toEqual({ items: [], totalCount: 0 })

            const unknown = await setup.send({ type: 'GetAllWaferProbeProjects', data: { filter: { wpMachineId: 1 } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: wpMachineId is not an allowed filter.' } })
        })

    })

    // ── CreateWaferProbeProject ───────────────────────────────────

    describe('CreateWaferProbeProject', () => {

        it('creates the project and stores the map as JSON', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWpProjects.CreateWpProjectMessage({ create: CREATE }))

            expect(reply).toMatchObject({ type: 'CreateWaferProbeProjectReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: PROJECT_1 })
            const rows = await setup.query<{ wpMachineId: number; waferTypeId: number; name: string; map: string }>(
                'select "wpMachineId", "waferTypeId", name, "local2GlobalMap"::text as map from main."WaferProbeProject"',
            )
            expect(rows.map((row) => ({ ...row, map: JSON.parse(row.map) as unknown })))
                .toEqual([{ wpMachineId: 1, waferTypeId: 1, name: CREATE.name, map: LOCAL_2_GLOBAL }])
        })

        it('rejects an unknown machine, wafer type, enum value or key, a map that is no JSON string and a duplicate name', async () => {
            await createProject(CREATE)
            const fresh = { ...CREATE, name: 'Other' }
            const cases: [Record<string, unknown>, string][] = [
                [{ ...fresh, wpMachineId: 999 }, 'Wafer probe machine 999 does not exist'],
                [{ ...fresh, waferTypeId: 999 }, 'Wafer type 999 does not exist'],
                [{ ...fresh, asicFamilyType: 'NOT_A_TYPE' }, 'NOT_A_TYPE is not a value of the asicFamilyType enum'],
                [{ ...fresh, orientation: 'Up' }, 'Up is not a value of the waferMapOrientation enum'],
                [{ ...fresh, local2GlobalMap: LOCAL_2_GLOBAL }, 'local2GlobalMap'],
                [{ ...fresh, local2GlobalMap: '{not json' }, 'data.create.local2GlobalMap must be a string holding valid JSON'],
                [{ ...fresh, name: CREATE.name }, 'already exists'],
                [{ ...fresh, colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateWaferProbeProject', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."WaferProbeProject"')).toEqual([{ n: 1 }])
        })

    })

})
