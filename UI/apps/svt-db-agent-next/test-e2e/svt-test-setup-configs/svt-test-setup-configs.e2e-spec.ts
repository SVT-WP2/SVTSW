import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigBody, EpicSvtTestSetupConfigCreateRequest } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestSetupConfigs, SvtDbAgentKafkaSvtTestSetups } from 'epic-api-types/kafka'

import { SVT_TEST_CONFIG_BODY, SVT_TEST_SETUP_CREATE, TestSetup } from '../utils'


/** Four-space indentation and a different key order: must come back exactly like this. */
const CONFIG_BODY_V1 = JSON.stringify({ emulator: { advanced_modelling: false }, boards: [] }, null, 4)

const CREATE: EpicSvtTestSetupConfigCreateRequest = { setupId: 1, name: 'ts_mit_config_v1', configBody: CONFIG_BODY_V1, note: null }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestSetupConfig>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestSetupConfig>
type BodyReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestSetupConfigBody>

describe('SVT test setup configs (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    /** Setup 1 with its default config 1 (`ts_mit_config_v0`). */
    beforeEach(async () => {
        await setup.clearDatabase()
        const reply = await setup.send(new SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupMessage({ create: SVT_TEST_SETUP_CREATE }))
        expect(reply.status, reply.error.message).toBe('Success')
    })

    async function createConfig(create: EpicSvtTestSetupConfigCreateRequest): Promise<EpicSvtTestSetupConfig> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTestSetupConfigs.CreateSvtTestSetupConfigMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaSvtTestSetupConfigs.GetAllSvtTestSetupConfigsData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestSetupConfigs.GetAllSvtTestSetupConfigsMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    async function today(): Promise<string> {
        const [row] = await setup.query<{ today: string }>('select current_date::text as today')
        return row.today
    }

    async function config1(): Promise<EpicSvtTestSetupConfig> {
        return { id: 1, setupId: 1, name: 'ts_mit_config_v0', note: 'default config', createdAt: await today() }
    }

    // ── GetAllSvtTestSetupConfigs ─────────────────────────────────

    describe('GetAllSvtTestSetupConfigs', () => {

        it('lists the configs in id order without their body, createdAt as YYYY-MM-DD', async () => {
            await createConfig(CREATE)

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestSetupConfigs.GetAllSvtTestSetupConfigsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllSvtTestSetupConfigsReply', status: 'Success' })
            expect(reply.data).toEqual({
                items: [await config1(), { id: 2, setupId: 1, name: 'ts_mit_config_v1', note: null, createdAt: await today() }],
                totalCount: 2,
            })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'setupId', 'name', 'note', 'createdAt'])
        })

        it('filters by ids and setupId (an empty list means all) and rejects an unknown filter key', async () => {
            await setup.send(new SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupMessage({
                create: { name: 'ts_2', generalLocation: 'CERN', defaultConfig: { name: 'ts_2_v0', configBody: '{}', note: null } },
            }))

            expect((await getAll({ filter: { setupId: 2 } })).items.map((item) => item.id)).toEqual([2])
            expect((await getAll({ filter: { ids: [1] } })).items.map((item) => item.id)).toEqual([1])
            expect((await getAll({ filter: { ids: [] } })).totalCount).toBe(2)
            expect((await getAll({ filter: { ids: [1], setupId: 2 } })).items).toEqual([])
            const unknown = await setup.send({ type: 'GetAllSvtTestSetupConfigs', data: { filter: { name: 'x' } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: name is not an allowed filter.' } })
        })

    })

    // ── CreateSvtTestSetupConfig ──────────────────────────────────

    describe('CreateSvtTestSetupConfig', () => {

        it('creates the config and keeps the body text verbatim', async () => {
            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestSetupConfigs.CreateSvtTestSetupConfigMessage({ create: CREATE }),
            )

            expect(reply).toMatchObject({ type: 'CreateSvtTestSetupConfigReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { id: 2, setupId: 1, name: 'ts_mit_config_v1', note: null, createdAt: await today() } })
            expect(await setup.query('select "configBody"::text as body from main."SvtTestSetupConfig" where id = 2'))
                .toEqual([{ body: CONFIG_BODY_V1 }])
        })

        it('rejects an unknown setup, a missing note key, a body that is no JSON string, a duplicate name and an unknown key', async () => {
            const cases: [Record<string, unknown>, string][] = [
                [{ ...CREATE, setupId: 999 }, 'Test setup 999 does not exist'],
                [{ setupId: 1, name: 'x', configBody: '{}' }, 'note'],
                [{ ...CREATE, configBody: '{oops' }, 'data.create.configBody must be a string holding valid JSON'],
                [{ ...CREATE, configBody: { a: 1 } }, 'configBody'],
                [{ ...CREATE, name: 'ts_mit_config_v0' }, 'already exists'],
                [{ ...CREATE, colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateSvtTestSetupConfig', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."SvtTestSetupConfig"')).toEqual([{ n: 1 }])
        })

    })

    // ── GetSvtTestSetupConfigBody ─────────────────────────────────

    describe('GetSvtTestSetupConfigBody', () => {

        it('returns the stored text byte for byte', async () => {
            await createConfig(CREATE)

            const reply = await setup.send<BodyReply>(new SvtDbAgentKafkaSvtTestSetupConfigs.GetSvtTestSetupConfigBodyMessage({ id: 1 }))
            const second = await setup.send<BodyReply>(new SvtDbAgentKafkaSvtTestSetupConfigs.GetSvtTestSetupConfigBodyMessage({ id: 2 }))

            expect(reply).toMatchObject({ type: 'GetSvtTestSetupConfigBodyReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { id: 1, configBody: SVT_TEST_CONFIG_BODY } })
            expect(second.data).toEqual({ entity: { id: 2, configBody: CONFIG_BODY_V1 } })
            expect(Object.keys(reply.data.entity)).toEqual(['id', 'configBody'])
        })

        it('answers NotFound for an unknown config (Q-H20) and BadRequest without id', async () => {
            const notFound = await setup.send(new SvtDbAgentKafkaSvtTestSetupConfigs.GetSvtTestSetupConfigBodyMessage({ id: 999 }))
            const missing = await setup.send({ type: 'GetSvtTestSetupConfigBody', data: {} })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { message: 'Test setup config 999 not found' } })
            expect(missing).toMatchObject({ status: 'BadRequest', error: { message: 'data.id must be an integer' } })
        })

    })

})
