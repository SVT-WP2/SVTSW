import { EpicSvtTestType, EpicSvtTestTypeCreateRequest } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestTypes } from 'svt-ts-types/kafka'

import { SVT_TEST_CONFIG_BODY, SVT_TEST_TYPE_CREATE, TestSetup } from '../utils'


/** DUT types come back in the enum's order (MOSAIX, BABYMOSAIX, AncMPW2_SLDO), not the request's. */
const TYPE_1: EpicSvtTestType = { id: 1, name: 'Impedance Test', dutTypes: ['MOSAIX', 'BABYMOSAIX'] }
const TYPE_2_CREATE: EpicSvtTestTypeCreateRequest = {
    name: 'SLDO_DACScan',
    dutTypes: ['AncMPW2_SLDO'],
    testTypeConfig: { name: 'DACSCAN__cap_1uF__m1__dac0', configBody: '{}', note: null },
}
const TYPE_2: EpicSvtTestType = { id: 2, name: 'SLDO_DACScan', dutTypes: ['AncMPW2_SLDO'] }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestType>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestType>
type DutRow = { dutType: string; testTypeId: number }

describe('SVT test types (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(() => setup.clearDatabase())

    async function createType(create: EpicSvtTestTypeCreateRequest): Promise<EpicSvtTestType> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    function dutRows(): Promise<DutRow[]> {
        return setup.query<DutRow>('select "dutType", "testTypeId" from main."SvtTestTypeDUTTypeList" order by "testTypeId", "dutType"')
    }

    async function count(table: string): Promise<number> {
        const [row] = await setup.query<{ n: number }>(`select count(*)::int as n from main."${table}"`)
        return row.n
    }

    // ── GetAllSvtTestTypes ────────────────────────────────────────

    describe('GetAllSvtTestTypes', () => {

        it('lists the types in id order with their DUT types in the enum order', async () => {
            await createType(SVT_TEST_TYPE_CREATE)
            await createType(TYPE_2_CREATE)

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestTypes.GetAllSvtTestTypesMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllSvtTestTypesReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [TYPE_1, TYPE_2], totalCount: 2 })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'name', 'dutTypes'])
        })

        it('lists a type without DUT types with dutTypes: [] (R-4)', async () => {
            await setup.query('insert into main."SvtTestType" (name) values (?)', ['bare'])

            expect(await getAll()).toEqual({ items: [{ id: 1, name: 'bare', dutTypes: [] }], totalCount: 1 })
        })

        it('filters by ids and by dutTypes (a type matches when it has any of them, D-4) and rejects an unknown key', async () => {
            await createType(SVT_TEST_TYPE_CREATE)
            await createType(TYPE_2_CREATE)

            expect((await getAll({ filter: { dutTypes: ['AncMPW2_SLDO'] } })).items).toEqual([TYPE_2])
            expect((await getAll({ filter: { dutTypes: ['BABYMOSAIX', 'AncMPW2_SLDO'] } })).items).toEqual([TYPE_1, TYPE_2])
            expect((await getAll({ filter: { dutTypes: ['BABYMOSAIX'], ids: [2] } })).items).toEqual([])
            expect((await getAll({ filter: { dutTypes: [], ids: [] } })).totalCount).toBe(2)
            expect((await getAll({ filter: { ids: [1] } })).items).toEqual([TYPE_1])
            const unknown = await setup.send({ type: 'GetAllSvtTestTypes', data: { filter: { dutType: 'MOSAIX' } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: dutType is not an allowed filter.' } })
        })

    })

    // ── CreateSvtTestType ─────────────────────────────────────────

    describe('CreateSvtTestType', () => {

        it('creates the type, its DUT types (deduplicated) and its first config in one go', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({
                create: { ...SVT_TEST_TYPE_CREATE, dutTypes: ['BABYMOSAIX', 'MOSAIX', 'BABYMOSAIX'] },
            }))

            expect(reply).toMatchObject({ type: 'CreateSvtTestTypeReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: TYPE_1 })
            expect(await setup.query('select id, name from main."SvtTestType"')).toEqual([{ id: 1, name: 'Impedance Test' }])
            expect(await dutRows()).toEqual([{ dutType: 'MOSAIX', testTypeId: 1 }, { dutType: 'BABYMOSAIX', testTypeId: 1 }])
            expect(await setup.query(
                `select id, "testTypeId", name, note, "configBody"::text as body, "createdAt" = current_date as today
                 from main."SvtTestTypeConfig"`,
            )).toEqual([{
                id: 1, testTypeId: 1, name: 'Impedance Test common', note: 'Impedance measurement common config',
                body: SVT_TEST_CONFIG_BODY, today: true,
            }])
        })

        it('rejects a bad DUT type, a body that is no JSON string, a duplicate name, a missing config and an unknown key', async () => {
            await createType(SVT_TEST_TYPE_CREATE)
            const fresh = TYPE_2_CREATE
            const cases: [Record<string, unknown>, string][] = [
                [{ ...fresh, dutTypes: ['MOSAIX', 'Moon'] }, 'Moon is not a value of the dutType enum'],
                [
                    { ...fresh, testTypeConfig: { ...fresh.testTypeConfig, configBody: '{oops' } },
                    'data.create.testTypeConfig.configBody must be a string holding valid JSON',
                ],
                [{ ...fresh, name: SVT_TEST_TYPE_CREATE.name }, 'already exists'],
                [{ name: fresh.name, dutTypes: fresh.dutTypes }, 'testTypeConfig'],
                [{ ...fresh, dutTypes: 'AncMPW2_SLDO' }, 'dutTypes'],
                [{ ...fresh, colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateSvtTestType', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await count('SvtTestType')).toBe(1)
            expect(await count('SvtTestTypeDUTTypeList')).toBe(2)
            expect(await count('SvtTestTypeConfig')).toBe(1)
        })

    })

    // ── UpdateSvtTestType ─────────────────────────────────────────

    describe('UpdateSvtTestType', () => {

        it('replaces the DUT types with the list sent (contract shape, D-1)', async () => {
            await createType(SVT_TEST_TYPE_CREATE)

            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestTypes.UpdateSvtTestTypeMessage({ id: 1, update: { dutTypes: ['AncMPW2_SLDO', 'MOSAIX'] } }),
            )
            const cleared = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestTypes.UpdateSvtTestTypeMessage({ id: 1, update: { dutTypes: [] } }),
            )

            expect(reply).toMatchObject({ type: 'UpdateSvtTestTypeReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...TYPE_1, dutTypes: ['MOSAIX', 'AncMPW2_SLDO'] } })
            expect(cleared.data).toEqual({ entity: { ...TYPE_1, dutTypes: [] } })
            expect(await dutRows()).toEqual([])
        })

        it('answers NotFound for an unknown type and BadRequest for a bad DUT type or the C++ payload shape', async () => {
            await createType(SVT_TEST_TYPE_CREATE)
            const cases: [Record<string, unknown>, string, string][] = [
                [{ id: 999, update: { dutTypes: ['MOSAIX'] } }, 'NotFound', 'Test type 999 not found'],
                [{ id: 1, update: { dutTypes: ['Moon'] } }, 'BadRequest', 'Moon is not a value of the dutType enum'],
                [{ testTypeId: 1, dutTypes: ['MOSAIX'] }, 'BadRequest', 'data.id must be an integer'],
                [{ id: 1, update: { dutTypes: ['MOSAIX'], name: 'renamed' } }, 'BadRequest', 'name'],
            ]
            for (const [data, status, message] of cases) {
                const reply = await setup.send({ type: 'UpdateSvtTestType', data })
                expect(reply.status, message).toBe(status)
                expect(reply.error.message).toContain(message)
            }
            expect(await dutRows()).toEqual([{ dutType: 'MOSAIX', testTypeId: 1 }, { dutType: 'BABYMOSAIX', testTypeId: 1 }])
        })

    })

})
