import { EpicSvtTestTemplate, EpicSvtTestTemplateCreateRequest } from 'svt-ts-types'
import {
    SvtDbAgentKafka,
    SvtDbAgentKafkaSvtTestTemplates,
    SvtDbAgentKafkaSvtTestTypeConfigs,
    SvtDbAgentKafkaSvtTestTypes,
} from 'svt-ts-types/kafka'

import { SVT_TEST_TYPE_CREATE, TestSetup } from '../utils'


const CREATE: EpicSvtTestTemplateCreateRequest = { dutType: 'MOSAIX', testTypeConfigId: 1, isEnabled: false }
const TEMPLATE_1: EpicSvtTestTemplate = { id: 1, dutType: 'MOSAIX', isEnabled: false, testTypeId: 1, testTypeConfigId: 1 }
const TEMPLATE_2: EpicSvtTestTemplate = { id: 2, dutType: 'BABYMOSAIX', isEnabled: true, testTypeId: 1, testTypeConfigId: 2 }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestTemplate>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestTemplate>

describe('SVT test templates (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    /** Test type 1 with configs 1 (`Impedance Test common`) and 2 (`Impedance Test float`). */
    beforeEach(async () => {
        await setup.clearDatabase()
        await send(new SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeMessage({ create: SVT_TEST_TYPE_CREATE }))
        await send(new SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigMessage({
            create: { testTypeId: 1, name: 'Impedance Test float', configBody: '{}', note: null },
        }))
    })

    async function send(message: { type: string; data?: unknown }): Promise<void> {
        const reply = await setup.send(message)
        if (reply.status !== 'Success') {
            throw new Error(`${message.type} failed: ${reply.error.message}`)
        }
    }

    async function createTemplate(create: EpicSvtTestTemplateCreateRequest): Promise<EpicSvtTestTemplate> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTestTemplates.CreateSvtTestTemplateMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaSvtTestTemplates.GetAllSvtTestTemplatesData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestTemplates.GetAllSvtTestTemplatesMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    // ── GetAllSvtTestTemplates ────────────────────────────────────

    describe('GetAllSvtTestTemplates', () => {

        it('lists the templates in id order with the test type of their config', async () => {
            await createTemplate(CREATE)
            await createTemplate({ dutType: 'BABYMOSAIX', testTypeConfigId: 2, isEnabled: true })

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestTemplates.GetAllSvtTestTemplatesMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllSvtTestTemplatesReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [TEMPLATE_1, TEMPLATE_2], totalCount: 2 })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'dutType', 'isEnabled', 'testTypeId', 'testTypeConfigId'])
        })

        it('filters by ids and dutTypes (an empty list means all) and rejects an unknown filter key', async () => {
            await createTemplate(CREATE)
            await createTemplate({ dutType: 'BABYMOSAIX', testTypeConfigId: 2, isEnabled: true })

            expect((await getAll({ filter: { dutTypes: ['BABYMOSAIX', 'AncMPW2_SLDO'] } })).items).toEqual([TEMPLATE_2])
            expect((await getAll({ filter: { ids: [1] } })).items).toEqual([TEMPLATE_1])
            expect((await getAll({ filter: { ids: [1], dutTypes: ['BABYMOSAIX'] } })).items).toEqual([])
            expect((await getAll({ filter: { ids: [], dutTypes: [] } })).totalCount).toBe(2)
            const unknown = await setup.send({ type: 'GetAllSvtTestTemplates', data: { filter: { testTypeId: 1 } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: testTypeId is not an allowed filter.' } })
        })

    })

    // ── CreateSvtTestTemplate ─────────────────────────────────────

    describe('CreateSvtTestTemplate', () => {

        it('creates the template honouring isEnabled (D-12)', async () => {
            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestTemplates.CreateSvtTestTemplateMessage({ create: CREATE }),
            )

            expect(reply).toMatchObject({ type: 'CreateSvtTestTemplateReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: TEMPLATE_1 })
            expect(await setup.query('select id, "dutType", "testTypeConfigId", "isEnabled" from main."SvtTestTemplate"'))
                .toEqual([{ id: 1, dutType: 'MOSAIX', testTypeConfigId: 1, isEnabled: false }])
        })

        it('rejects a bad DUT type, an unknown config, a non-boolean or missing isEnabled, a duplicate pair, an unknown key', async () => {
            await createTemplate(CREATE)
            const cases: [Record<string, unknown>, string][] = [
                [{ ...CREATE, dutType: 'Moon' }, 'Moon is not a value of the dutType enum'],
                [{ ...CREATE, testTypeConfigId: 999 }, 'Test type config 999 does not exist'],
                [{ ...CREATE, isEnabled: 'yes' }, 'isEnabled'],
                [{ dutType: 'BABYMOSAIX', testTypeConfigId: 1 }, 'isEnabled'],
                [{ ...CREATE, isEnabled: true }, 'already exists'],
                [{ ...CREATE, dutType: 'BABYMOSAIX', colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateSvtTestTemplate', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."SvtTestTemplate"')).toEqual([{ n: 1 }])
        })

    })

    // ── UpdateSvtTestTemplate ─────────────────────────────────────

    describe('UpdateSvtTestTemplate', () => {

        it('toggles isEnabled', async () => {
            await createTemplate(CREATE)

            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestTemplates.UpdateSvtTestTemplateMessage({ id: 1, update: { isEnabled: true } }),
            )

            expect(reply).toMatchObject({ type: 'UpdateSvtTestTemplateReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...TEMPLATE_1, isEnabled: true } })
            expect(await setup.query('select "isEnabled" from main."SvtTestTemplate"')).toEqual([{ isEnabled: true }])
        })

        it('answers NotFound for an unknown template and BadRequest for a non-boolean isEnabled or a foreign key', async () => {
            await createTemplate(CREATE)
            const cases: [Record<string, unknown>, string, string][] = [
                [{ id: 999, update: { isEnabled: true } }, 'NotFound', 'Test template 999 not found'],
                [{ id: 1, update: { isEnabled: 'yes' } }, 'BadRequest', 'isEnabled'],
                [{ id: 1, update: { isEnabled: true, dutType: 'BABYMOSAIX' } }, 'BadRequest', 'dutType'],
            ]
            for (const [data, status, message] of cases) {
                const reply = await setup.send({ type: 'UpdateSvtTestTemplate', data })
                expect(reply.status, message).toBe(status)
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select "isEnabled" from main."SvtTestTemplate"')).toEqual([{ isEnabled: false }])
        })

    })

})
