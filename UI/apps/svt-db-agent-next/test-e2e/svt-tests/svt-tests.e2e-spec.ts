import {
    EpicSvtTestEntity,
    SvtDbAgentKafka,
    SvtDbAgentKafkaChips,
    SvtDbAgentKafkaSvtTests,
    SvtDbAgentKafkaSvtTestSetups,
    SvtDbAgentKafkaSvtTestTypeConfigs,
    SvtDbAgentKafkaSvtTestTypes,
    SvtDbAgentKafkaWafers,
    SvtDbAgentKafkaWaferTypes,
} from 'epic/entities'
import { EpicSvtTestCreateRequest } from 'epic-api-types'

import { SVT_TEST_SETUP_CREATE, SVT_TEST_TYPE_CREATE, TestSetup } from '../utils'


/** Two dies, one row: ASIC 1 `W-1_0_0` (MOSAIX) and ASIC 2 `W-1_0_1` (BABYMOSAIX). */
const SMALL_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }, { PosInGroup: 1, FamilyType: 'BABYMOSAIX' }] },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: [0, 1],
            }],
        },
    },
})

const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const CREATE: EpicSvtTestCreateRequest = { dutEntityName: 'Asic', dutId: 1, testTypeConfigId: 1, testSetupConfigId: 1 }
const CHIP_TEST_CREATE: EpicSvtTestCreateRequest = { dutEntityName: 'Chip', dutId: 1, testTypeConfigId: 2, testSetupConfigId: 1 }

/** A freshly created test: nothing started, nothing finished, no result. */
const FRESH = { startedAt: null, finishedAt: null, pathToResult: null, testResultStatus: null }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestEntity>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestEntity>

describe('SVT tests (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    /** ASICs 1 and 2, chip 1 (of ASIC 1), test type 1 with configs 1 and 2, test setup 1 with config 1. */
    beforeEach(async () => {
        await setup.clearDatabase()
        await send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({
            create: { name: 'Small', engineeringRun: 'ER1', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: SMALL_MAP },
        }))
        await send(new SvtDbAgentKafkaWafers.CreateWaferMessage({
            create: {
                serialNumber: 'W-1', batchNumber: 1, thinningDate: null, dicingDate: null, productionDate: null,
                waferTypeId: 1, generalLocation: 'CERN',
            },
        }))
        await send(new SvtDbAgentKafkaChips.CreateChipMessage({ create: { serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' } }))
        await send(new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({ create: SVT_TEST_TYPE_CREATE }))
        await send(new SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigMessage({
            create: { testTypeId: 1, name: 'Impedance Test float', configBody: '{}', note: null },
        }))
        await send(new SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupMessage({ create: SVT_TEST_SETUP_CREATE }))
    })

    /** Seeding through the agent; throws on a failed reply. */
    async function send(message: { type: string; data?: unknown }): Promise<void> {
        const reply = await setup.send(message)
        if (reply.status !== 'Success') {
            throw new Error(`${message.type} failed: ${reply.error.message}`)
        }
    }

    async function createTest(create: EpicSvtTestCreateRequest): Promise<EpicSvtTestEntity> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTests.CreateSvtTestMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaSvtTests.GetAllSvtTestsData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTests.GetAllSvtTestsMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    async function ids(data: SvtDbAgentKafkaSvtTests.GetAllSvtTestsData): Promise<number[]> {
        return (await getAll(data)).items.map((item) => item.id)
    }

    async function start(id: number, startedAt: string): Promise<EntityReply> {
        const reply = await setup.send<EntityReply>({ type: 'UpdateSvtTestStart', data: { id, update: { startedAt } } })
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    async function count(table: string): Promise<number> {
        const [row] = await setup.query<{ n: number }>(`select count(*)::int as n from main."${table}"`)
        return row.n
    }

    // ── GetAllSvtTests ────────────────────────────────────────────

    describe('GetAllSvtTests', () => {

        it('lists the tests newest first with their device and ISO 8601 timestamps', async () => {
            const first = await createTest(CREATE)
            const second = await createTest(CHIP_TEST_CREATE)

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTests.GetAllSvtTestsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllSvtTestsReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [second, first], totalCount: 2 })
            expect(reply.data.items[0]).toMatchObject({
                id: 2, dutEntityName: 'Chip', dutId: 1, testTypeConfigId: 2, testSetupConfigId: 1, ...FRESH,
            })
            expect(reply.data.items[0].createdAt).toMatch(ISO_DATE_TIME)
            expect(Object.keys(reply.data.items[0])).toEqual([
                'id', 'dutEntityName', 'dutId', 'testTypeConfigId', 'testSetupConfigId', 'createdAt', 'startedAt', 'finishedAt',
                'pathToResult', 'testResultStatus',
            ])
        })

        it('filters by ids, device, config ids and result statuses (empty lists mean all)', async () => {
            await createTest(CREATE)
            await createTest(CHIP_TEST_CREATE)
            await createTest({ ...CREATE, dutId: 2 })
            await setup.send({
                type: 'UpdateSvtTestFinish',
                data: { id: 3, update: { finishedAt: '2026-03-01T12:00:00Z', pathToResult: '/results/3', testResultStatus: 'SUCCESS' } },
            })

            expect(await ids({ filter: { ids: [1, 3] } })).toEqual([3, 1])
            expect(await ids({ filter: { dutEntityNames: ['Asic'] } })).toEqual([3, 1])
            expect(await ids({ filter: { dutEntityNames: ['Chip', 'ChipBlock'] } })).toEqual([2])
            expect(await ids({ filter: { dutId: 1 } })).toEqual([2, 1])
            expect(await ids({ filter: { dutEntityNames: ['Asic'], dutId: 1 } })).toEqual([1])
            expect(await ids({ filter: { dutEntityNames: ['ChipBlock'], dutId: 1 } })).toEqual([])
            expect(await ids({ filter: { testTypeConfigIds: [2] } })).toEqual([2])
            expect(await ids({ filter: { testSetupConfigIds: [1] } })).toEqual([3, 2, 1])
            expect(await ids({ filter: { testSetupConfigIds: [999] } })).toEqual([])
            expect(await ids({ filter: { testResultStatuses: ['SUCCESS', 'FAILURE'] } })).toEqual([3])
            expect(await ids({ filter: { ids: [], dutEntityNames: [], testResultStatuses: [] } })).toEqual([3, 2, 1])
        })

        it('filters by timestamp ranges: From inclusive, To exclusive, NULL never matches', async () => {
            await createTest(CREATE)
            await createTest(CHIP_TEST_CREATE)
            await start(1, '2026-03-01T10:00:00Z')
            await start(2, '2026-03-02T10:00:00Z')

            expect(await ids({ filter: { startedAtFrom: '2026-03-02T10:00:00Z' } })).toEqual([2])
            expect(await ids({ filter: { startedAtTo: '2026-03-02T10:00:00Z' } })).toEqual([1])
            expect(await ids({ filter: { startedAtFrom: '2026-03-01T10:00:00Z', startedAtTo: '2026-03-02T10:00:00Z' } }))
                .toEqual([1])
            expect(await ids({ filter: { createdAtFrom: '2000-01-01T00:00:00Z' } })).toEqual([2, 1])
            expect(await ids({ filter: { createdAtTo: '2000-01-01T00:00:00Z' } })).toEqual([])
            expect(await ids({ filter: { finishedAtFrom: '2000-01-01T00:00:00Z' } })).toEqual([])
        })

        it('pages database-side and rejects an unknown filter key or a bad date', async () => {
            await createTest(CREATE)
            await createTest(CHIP_TEST_CREATE)

            expect(await getAll({ pager: { limit: 1, offset: 1 } })).toMatchObject({ items: [{ id: 1 }], totalCount: 2 })
            const unknown = await setup.send({ type: 'GetAllSvtTests', data: { filter: { status: 'Pending' } } })
            const badDate = await setup.send({ type: 'GetAllSvtTests', data: { filter: { createdAtFrom: 'yesterday' } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: status is not an allowed filter.' } })
            expect(badDate).toMatchObject({
                status: 'BadRequest', error: { message: 'data.filter.createdAtFrom must be an ISO 8601 date-time' },
            })
        })

    })

    // ── CreateSvtTest ─────────────────────────────────────────────

    describe('CreateSvtTest', () => {

        it('creates the test with its two device link rows, createdAt stamped by the database', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTests.CreateSvtTestMessage({ create: CREATE }))

            expect(reply).toMatchObject({ type: 'CreateSvtTestReply', status: 'Success' })
            expect(reply.data.entity).toMatchObject({ id: 1, ...CREATE, ...FRESH })
            expect(reply.data.entity.createdAt).toMatch(ISO_DATE_TIME)
            expect(await setup.query(
                `select id, "testTypeConfigId", "testSetupConfigId", "createdAt" is not null as stamped, "startedAt", "testResultStatus"
                 from main."SvtTestList"`,
            )).toEqual([{ id: 1, testTypeConfigId: 1, testSetupConfigId: 1, stamped: true, startedAt: null, testResultStatus: null }])
            expect(await setup.query('select "testId", "dutEntityName" from main."SvtTestListToEntityName"'))
                .toEqual([{ testId: 1, dutEntityName: 'Asic' }])
            expect(await setup.query('select "testId", "dutId" from main."SvtTestListToEntityId"')).toEqual([{ testId: 1, dutId: 1 }])
        })

        it('accepts a chip and a chip block as the device', async () => {
            await setup.query(
                'insert into main."ChipBlock" ("chipId", "blockType", "serialNumber") values (1, ?, ?)',
                ['AncMPW2_SLDO', 'B-1'],
            )

            const chip = await createTest(CHIP_TEST_CREATE)
            const block = await createTest({ ...CREATE, dutEntityName: 'ChipBlock', dutId: 1 })

            expect(chip).toMatchObject({ dutEntityName: 'Chip', dutId: 1 })
            expect(block).toMatchObject({ dutEntityName: 'ChipBlock', dutId: 1 })
        })

        it('rejects a bad device name, a missing device, unknown configs and an unknown key, writing nothing', async () => {
            const cases: [Record<string, unknown>, string][] = [
                [{ ...CREATE, dutEntityName: 'Wafer' }, 'Wafer is not a value of the dutEntityName enum'],
                [{ ...CREATE, dutId: 999 }, 'Asic 999 does not exist'],
                [{ ...CREATE, dutEntityName: 'Chip', dutId: 2 }, 'Chip 2 does not exist'],
                [{ ...CREATE, dutEntityName: 'ChipBlock', dutId: 1 }, 'ChipBlock 1 does not exist'],
                [{ ...CREATE, testTypeConfigId: 999 }, 'Test type config 999 does not exist'],
                [{ ...CREATE, testSetupConfigId: 999 }, 'Test setup config 999 does not exist'],
                [{ ...CREATE, dutId: '1' }, 'dutId'],
                [{ ...CREATE, colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateSvtTest', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await count('SvtTestList')).toBe(0)
            expect(await count('SvtTestListToEntityName')).toBe(0)
            expect(await count('SvtTestListToEntityId')).toBe(0)
        })

    })

    // ── UpdateSvtTestStart ────────────────────────────────────────

    describe('UpdateSvtTestStart', () => {

        it('records the start time: ISO 8601 in and out, stored as UTC', async () => {
            await createTest(CREATE)

            const reply = await setup.send<EntityReply>({
                type: 'UpdateSvtTestStart', data: { id: 1, update: { startedAt: '2026-03-01T10:15:30Z' } },
            })

            expect(reply).toMatchObject({ type: 'UpdateSvtTestStartReply', status: 'Success' })
            expect(reply.data.entity).toMatchObject({ id: 1, ...CREATE, startedAt: '2026-03-01T10:15:30.000Z', finishedAt: null })
            expect(await setup.query('select "startedAt"::text as "startedAt" from main."SvtTestList"'))
                .toEqual([{ startedAt: '2026-03-01 10:15:30' }])
        })

        it('answers NotFound for an unknown test and BadRequest for a malformed update', async () => {
            await createTest(CREATE)
            const cases: [Record<string, unknown>, string, string][] = [
                [{ id: 999, update: { startedAt: '2026-03-01T10:15:30Z' } }, 'NotFound', 'Test 999 not found'],
                [{ id: 1, update: { startedAt: 'yesterday' } }, 'BadRequest', 'startedAt'],
                [{ id: 1, update: {} }, 'BadRequest', 'startedAt'],
                [{ id: 1, update: { startedAt: '2026-03-01T10:15:30Z', pathToResult: '/x' } }, 'BadRequest', 'pathToResult'],
                [{ update: { startedAt: '2026-03-01T10:15:30Z' } }, 'BadRequest', 'data.id must be an integer'],
            ]
            for (const [data, status, message] of cases) {
                const reply = await setup.send({ type: 'UpdateSvtTestStart', data })
                expect(reply.status, message).toBe(status)
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select "startedAt" from main."SvtTestList"')).toEqual([{ startedAt: null }])
        })

    })

    // ── UpdateSvtTestFinish ───────────────────────────────────────

    describe('UpdateSvtTestFinish', () => {

        const finish = { finishedAt: '2026-03-01T11:00:00.500Z', pathToResult: '/results/test-1', testResultStatus: 'PARTIAL_SUCCESS' }

        it('records the finish time, the result path and the result status', async () => {
            await createTest(CREATE)
            await start(1, '2026-03-01T10:15:30Z')

            const reply = await setup.send<EntityReply>({ type: 'UpdateSvtTestFinish', data: { id: 1, update: finish } })

            expect(reply).toMatchObject({ type: 'UpdateSvtTestFinishReply', status: 'Success' })
            expect(reply.data.entity).toMatchObject({ id: 1, startedAt: '2026-03-01T10:15:30.000Z', ...finish })
            expect(await setup.query(
                'select "finishedAt"::text as "finishedAt", "pathToResult", "testResultStatus" from main."SvtTestList"',
            )).toEqual([{ finishedAt: '2026-03-01 11:00:00.5', pathToResult: '/results/test-1', testResultStatus: 'PARTIAL_SUCCESS' }])
            expect(await ids({ filter: { testResultStatuses: ['PARTIAL_SUCCESS'] } })).toEqual([1])
        })

        it('rejects a status outside the database enum (the UI vocabulary differs), a missing field and an unknown test', async () => {
            await createTest(CREATE)
            const cases: [Record<string, unknown>, string, string][] = [
                [{ id: 1, update: { ...finish, testResultStatus: 'Completed' } }, 'BadRequest', 'Completed is not a value of the'],
                [{ id: 1, update: { finishedAt: finish.finishedAt, testResultStatus: 'SUCCESS' } }, 'BadRequest', 'pathToResult'],
                [{ id: 1, update: { ...finish, finishedAt: 'later' } }, 'BadRequest', 'finishedAt'],
                [{ id: 999, update: finish }, 'NotFound', 'Test 999 not found'],
            ]
            for (const [data, status, message] of cases) {
                const reply = await setup.send({ type: 'UpdateSvtTestFinish', data })
                expect(reply.status, message).toBe(status)
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select "finishedAt", "testResultStatus" from main."SvtTestList"'))
                .toEqual([{ finishedAt: null, testResultStatus: null }])
        })

    })

})
