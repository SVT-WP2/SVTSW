import { EpicSvtTestTypeConfig, EpicSvtTestTypeConfigBody, EpicSvtTestTypeConfigCreateRequest } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestTypeConfigs, SvtDbAgentKafkaSvtTestTypes } from 'svt-ts-types/kafka'

import { expectListPaging, SVT_TEST_CONFIG_BODY, SVT_TEST_TYPE_CREATE, TestSetup } from '../utils'


/** One-space indentation as the dev database has it: must come back exactly like this. */
const CONFIG_BODY_FLOAT = JSON.stringify(
    { generic_name: 'ImpedanceTest', name: 'Float', parameters: { measurement_type: 'float' } },
    null,
    1,
)

const CREATE: EpicSvtTestTypeConfigCreateRequest = {
    testTypeId: 1, name: 'Impedance Test float', configBody: CONFIG_BODY_FLOAT, note: 'Impedance measurement float config',
}

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestTypeConfig>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestTypeConfig>
type BodyReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestTypeConfigBody>

describe('SVT test type configs (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    /** Test type 1 with its first config 1 (`Impedance Test common`). */
    beforeEach(async () => {
        await setup.clearDatabase()
        const reply = await setup.send(new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({ create: SVT_TEST_TYPE_CREATE }))
        expect(reply.status, reply.error.message).toBe('Success')
    })

    async function createConfig(create: EpicSvtTestTypeConfigCreateRequest): Promise<EpicSvtTestTypeConfig> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaSvtTestTypeConfigs.GetAllSvtTestTypeConfigsData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestTypeConfigs.GetAllSvtTestTypeConfigsMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    async function today(): Promise<string> {
        const [row] = await setup.query<{ today: string }>('select current_date::text as today')
        return row.today
    }

    /** Test type 2 (`StepRamp`) with its first config 2 (`StepRamp default`). */
    async function createStepRampType(): Promise<void> {
        const reply = await setup.send(new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({
            create: { name: 'StepRamp', dutTypes: ['MOSAIX'], testTypeConfig: { name: 'StepRamp default', configBody: '{}', note: null } },
        }))
        expect(reply.status, reply.error.message).toBe('Success')
    }

    // ── GetAllSvtTestTypeConfigs ──────────────────────────────────

    describe('GetAllSvtTestTypeConfigs', () => {

        it('lists the configs in id order without their body, createdAt as YYYY-MM-DD', async () => {
            await createConfig(CREATE)

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestTypeConfigs.GetAllSvtTestTypeConfigsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllSvtTestTypeConfigsReply', status: 'Success' })
            await expectListPaging(setup, 'GetAllSvtTestTypeConfigs', reply.data.items)
            const createdAt = await today()
            expect(reply.data).toEqual({
                items: [
                    { id: 1, testTypeId: 1, name: 'Impedance Test common', note: 'Impedance measurement common config', createdAt },
                    { id: 2, testTypeId: 1, name: 'Impedance Test float', note: 'Impedance measurement float config', createdAt },
                ],
                totalCount: 2,
            })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'testTypeId', 'name', 'note', 'createdAt'])
        })

        it('filters by ids and testTypeId (an empty list means all) and rejects an unknown filter key', async () => {
            await createStepRampType()

            expect((await getAll({ filter: { testTypeId: 2 } })).items.map((item) => item.id)).toEqual([2])
            expect((await getAll({ filter: { ids: [1] } })).items.map((item) => item.id)).toEqual([1])
            expect((await getAll({ filter: { ids: [] } })).totalCount).toBe(2)
            expect((await getAll({ filter: { ids: [1], testTypeId: 2 } })).items).toEqual([])
            const unknown = await setup.send({ type: 'GetAllSvtTestTypeConfigs', data: { filter: { setupId: 1 } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: setupId is not an allowed filter.' } })
        })

    })

    // ── CreateSvtTestTypeConfig ───────────────────────────────────

    describe('CreateSvtTestTypeConfig', () => {

        it('creates the config and keeps the body text verbatim', async () => {
            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigMessage({ create: CREATE }),
            )

            expect(reply).toMatchObject({ type: 'CreateSvtTestTypeConfigReply', status: 'Success' })
            expect(reply.data).toEqual({
                entity: { id: 2, testTypeId: 1, name: CREATE.name, note: CREATE.note, createdAt: await today() },
            })
            expect(await setup.query('select "configBody"::text as body from main."SvtTestTypeConfig" where id = 2'))
                .toEqual([{ body: CONFIG_BODY_FLOAT }])
        })

        it('accepts the same name under another test type but not twice under one (database index)', async () => {
            await createStepRampType()

            const other = await setup.send({
                type: 'CreateSvtTestTypeConfig', data: { create: { ...CREATE, name: 'StepRamp default' } },
            })
            const same = await setup.send({
                type: 'CreateSvtTestTypeConfig', data: { create: { ...CREATE, name: 'Impedance Test common' } },
            })

            expect(other.status, other.error.message).toBe('Success')
            expect(same.status).toBe('BadRequest')
            expect(same.error.message).toContain('already exists')
        })

        it('rejects an unknown type, a missing note key, a body that is no JSON string and an unknown key', async () => {
            const cases: [Record<string, unknown>, string][] = [
                [{ ...CREATE, testTypeId: 999 }, 'Test type 999 does not exist'],
                [{ testTypeId: 1, name: 'x', configBody: '{}' }, 'note'],
                [{ ...CREATE, configBody: '{oops' }, 'data.create.configBody must be a string holding valid JSON'],
                [{ ...CREATE, configBody: { a: 1 } }, 'configBody'],
                [{ ...CREATE, colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateSvtTestTypeConfig', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."SvtTestTypeConfig"')).toEqual([{ n: 1 }])
        })

    })

    // ── GetSvtTestTypeConfigBody ──────────────────────────────────

    describe('GetSvtTestTypeConfigBody', () => {

        it('returns the stored text byte for byte', async () => {
            await createConfig(CREATE)

            const first = await setup.send<BodyReply>(new SvtDbAgentKafkaSvtTestTypeConfigs.GetSvtTestTypeConfigBodyMessage({ id: 1 }))
            const second = await setup.send<BodyReply>(new SvtDbAgentKafkaSvtTestTypeConfigs.GetSvtTestTypeConfigBodyMessage({ id: 2 }))

            expect(first).toMatchObject({ type: 'GetSvtTestTypeConfigBodyReply', status: 'Success' })
            expect(first.data).toEqual({ entity: { id: 1, configBody: SVT_TEST_CONFIG_BODY } })
            expect(second.data).toEqual({ entity: { id: 2, configBody: CONFIG_BODY_FLOAT } })
        })

        it('answers NotFound for an unknown config (Q-H20) and BadRequest without id', async () => {
            const notFound = await setup.send(new SvtDbAgentKafkaSvtTestTypeConfigs.GetSvtTestTypeConfigBodyMessage({ id: 999 }))
            const missing = await setup.send({ type: 'GetSvtTestTypeConfigBody', data: {} })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { message: 'Test type config 999 not found' } })
            expect(missing).toMatchObject({ status: 'BadRequest', error: { message: 'data.id must be an integer' } })
        })

    })

})
