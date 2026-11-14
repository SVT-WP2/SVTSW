import { EpicAsic, EpicAsicCreateRequest } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaAsics, SvtDbAgentKafkaWafers, SvtDbAgentKafkaWaferTypes } from 'svt-ts-types/kafka'

import { TestSetup } from '../utils'


/** Two dies, one row: the wafer created in beforeEach yields ASICs W-1_0_0 (MOSAIX) and W-1_0_1 (BABYMOSAIX). */
const SMALL_MAP = JSON.stringify({
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

const WAFER_ID = 1
const MOSAIX: EpicAsic = {
    id: 1,
    serialNumber: 'W-1_0_0',
    waferId: WAFER_ID,
    chipId: null,
    familyType: 'MOSAIX',
    waferMapPosition: '0_0',
    quality: 'MechanicallyInteger',
}
const BABY: EpicAsic = {
    id: 2,
    serialNumber: 'W-1_0_1',
    waferId: WAFER_ID,
    chipId: null,
    familyType: 'BABYMOSAIX',
    waferMapPosition: '0_1',
    quality: 'MechanicallyDamaged',
}

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicAsic>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicAsic>

describe('ASICs (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

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
    })

    /** Seeding through the agent; throws on a failed reply. */
    async function send(message: { type: string; data?: unknown }): Promise<void> {
        const reply = await setup.send(message)
        if (reply.status !== 'Success') {
            throw new Error(`${message.type} failed: ${reply.error.message}`)
        }
    }

    async function getAll(data: SvtDbAgentKafkaAsics.GetAllAsicsMessageData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaAsics.GetAllAsicsMessage(data))
        expect(reply.status).toBe('Success')
        return reply.data
    }

    // ── GetAllAsics ───────────────────────────────────────────────

    describe('GetAllAsics', () => {

        it('lists the ASICs of the database in id order with chipId null while no chip exists', async () => {
            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaAsics.GetAllAsicsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllAsicsReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [MOSAIX, BABY], totalCount: 2 })
            expect(Object.keys(reply.data.items[0])).toEqual([
                'id', 'serialNumber', 'waferId', 'chipId', 'familyType', 'waferMapPosition', 'quality',
            ])
        })

        it('filters by ids, waferId, familyTypes, quality and a serial-number substring', async () => {
            expect(await getAll({ filter: { ids: [2] } })).toEqual({ items: [BABY], totalCount: 1 })
            expect(await getAll({ filter: { waferId: WAFER_ID } })).toEqual({ items: [MOSAIX, BABY], totalCount: 2 })
            expect(await getAll({ filter: { waferId: 999 } })).toEqual({ items: [], totalCount: 0 })
            expect(await getAll({ filter: { familyTypes: ['BABYMOSAIX', 'LAS'] } })).toEqual({ items: [BABY], totalCount: 1 })
            expect(await getAll({ filter: { quality: 'MechanicallyInteger' } })).toEqual({ items: [MOSAIX], totalCount: 1 })
            expect(await getAll({ filter: { serialNumber: '_0_1' } })).toEqual({ items: [BABY], totalCount: 1 })
            expect(await getAll({ filter: { serialNumber: 'w-1' } })).toEqual({ items: [MOSAIX, BABY], totalCount: 2 })
            expect(await getAll({ filter: { serialNumber: '%' } })).toEqual({ items: [], totalCount: 0 })
        })

        it('reports the chip diced from an ASIC and filters by chipId', async () => {
            await setup.query(`insert into main."Chip" ("asicId", "serialNumber", "generalLocation") values (${MOSAIX.id}, 'C-1', 'CERN')`)

            expect(await getAll()).toEqual({ items: [{ ...MOSAIX, chipId: 1 }, BABY], totalCount: 2 })
            expect(await getAll({ filter: { chipId: 1 } })).toEqual({ items: [{ ...MOSAIX, chipId: 1 }], totalCount: 1 })
            expect(await getAll({ filter: { chipId: 1, ids: [BABY.id] } })).toEqual({ items: [], totalCount: 0 })
            expect(await getAll({ filter: { chipId: 999 } })).toEqual({ items: [], totalCount: 0 })
        })

        it('pages database-side; the WPAgent call shape works', async () => {
            expect(await getAll({ pager: { limit: 1, offset: 1 } })).toEqual({ items: [BABY], totalCount: 2 })
            const wpAgentCall = await getAll({ filter: { ids: [MOSAIX.id] }, pager: { limit: 1, offset: 0 } })
            expect(wpAgentCall).toEqual({ items: [MOSAIX], totalCount: 1 })
        })

        it('rejects an unknown filter key with the C++ message, and wrongly typed filters', async () => {
            const unknown = await setup.send({ type: 'GetAllAsics', data: { filter: { colour: 'blue' } } })
            const wrongType = await setup.send({ type: 'GetAllAsics', data: { filter: { waferId: '1' } } })

            expect(unknown).toMatchObject({
                status: 'BadRequest', data: null, error: { message: 'Error: colour is not an allowed filter.' },
            })
            expect(wrongType).toMatchObject({ status: 'BadRequest', error: { message: 'data.filter.waferId must be an integer' } })
        })

    })

    // ── CreateAsic ────────────────────────────────────────────────

    describe('CreateAsic', () => {

        const create: EpicAsicCreateRequest = {
            serialNumber: 'MANUAL-1', waferId: WAFER_ID, familyType: 'LAS', waferMapPosition: '9_9', quality: 'CoveredByGreenLayer',
        }

        it('creates a manual ASIC and returns it with chipId null', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaAsics.CreateAsicMessage({ create }))

            expect(reply).toMatchObject({ type: 'CreateAsicReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { id: 3, ...create, chipId: null } })
            const rows = await setup.query(
                'select "serialNumber", "waferId", "familyType", "waferMapPosition", quality from main."Asic" where id = 3',
            )
            expect(rows).toEqual([{
                serialNumber: 'MANUAL-1', waferId: WAFER_ID, familyType: 'LAS', waferMapPosition: '9_9', quality: 'CoveredByGreenLayer',
            }])
        })

        it('rejects unknown enum values, an unknown wafer, a duplicate serial number and an unknown key', async () => {
            const cases: [Record<string, unknown>, string][] = [
                [{ ...create, familyType: 'NOT_A_TYPE' }, 'NOT_A_TYPE is not a value of the asicFamilyType enum'],
                [{ ...create, quality: 'Fine' }, 'Fine is not a value of the asicQuality enum'],
                [{ ...create, waferId: 999 }, 'Wafer 999 does not exist'],
                [{ ...create, serialNumber: MOSAIX.serialNumber }, 'already exists'],
                [{ ...create, colour: 'blue' }, 'colour'],
            ]
            for (const [body, message] of cases) {
                const reply = await setup.send({ type: 'CreateAsic', data: { create: body } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."Asic"')).toEqual([{ n: 2 }])
        })

    })

})
