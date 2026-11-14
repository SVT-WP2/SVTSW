import { EpicSvtTestSetup, EpicSvtTestSetupCreateRequest } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestSetupConfigs, SvtDbAgentKafkaSvtTestSetups } from 'epic-api-types/kafka'

import { SVT_TEST_CONFIG_BODY, SVT_TEST_SETUP_CREATE, TestSetup } from '../utils'


const SETUP_1: EpicSvtTestSetup = { id: 1, name: 'ts_mit', defaultConfigId: 1, generalLocation: 'CERN_186_R_E10' }
const SETUP_2_CREATE: EpicSvtTestSetupCreateRequest = {
    name: 'sldo_ts_brunel',
    generalLocation: 'Brunel',
    defaultConfig: { name: 'sldo_ts_brunel_config_v0', configBody: '{}', note: null },
}
const SETUP_2: EpicSvtTestSetup = { id: 2, name: 'sldo_ts_brunel', defaultConfigId: 2, generalLocation: 'Brunel' }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestSetup>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestSetup>
type DefaultRow = { setupId: number; defaultConfigId: number | null }

describe('SVT test setups (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(() => setup.clearDatabase())

    async function createSetup(create: EpicSvtTestSetupCreateRequest): Promise<EpicSvtTestSetup> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaSvtTestSetups.GetAllSvtTestSetupsData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestSetups.GetAllSvtTestSetupsMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    function defaultRows(): Promise<DefaultRow[]> {
        return setup.query<DefaultRow>('select "setupId", "defaultConfigId" from main."SvtTestSetupDefaultConfig" order by "setupId"')
    }

    async function count(table: string): Promise<number> {
        const [row] = await setup.query<{ n: number }>(`select count(*)::int as n from main."${table}"`)
        return row.n
    }

    // ── GetAllSvtTestSetups ───────────────────────────────────────

    describe('GetAllSvtTestSetups', () => {

        it('lists the setups in id order with their default config id', async () => {
            await createSetup(SVT_TEST_SETUP_CREATE)
            await createSetup(SETUP_2_CREATE)

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaSvtTestSetups.GetAllSvtTestSetupsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllSvtTestSetupsReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [SETUP_1, SETUP_2], totalCount: 2 })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'name', 'defaultConfigId', 'generalLocation'])
        })

        it('lists a setup without a default-config row with defaultConfigId null instead of failing (Q-R2)', async () => {
            await setup.query('insert into main."SvtTestSetup" (name, "generalLocation") values (?, ?)', ['bare', 'CERN'])

            expect(await getAll()).toEqual({
                items: [{ id: 1, name: 'bare', defaultConfigId: null, generalLocation: 'CERN' }],
                totalCount: 1,
            })
        })

        it('filters by ids (an empty list means all) and rejects an unknown filter key', async () => {
            await createSetup(SVT_TEST_SETUP_CREATE)
            await createSetup(SETUP_2_CREATE)

            expect(await getAll({ filter: { ids: [2] } })).toEqual({ items: [SETUP_2], totalCount: 1 })
            expect((await getAll({ filter: { ids: [] } })).totalCount).toBe(2)
            expect(await getAll({ filter: { ids: [999] } })).toEqual({ items: [], totalCount: 0 })
            const unknown = await setup.send({ type: 'GetAllSvtTestSetups', data: { filter: { name: 'ts_mit' } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: name is not an allowed filter.' } })
        })

    })

    // ── CreateSvtTestSetup ────────────────────────────────────────

    describe('CreateSvtTestSetup', () => {

        it('creates the setup, its first config (text kept verbatim) and the default-config row', async () => {
            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupMessage({ create: SVT_TEST_SETUP_CREATE }),
            )

            expect(reply).toMatchObject({ type: 'CreateSvtTestSetupReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: SETUP_1 })
            expect(await setup.query('select id, name, "generalLocation" from main."SvtTestSetup"'))
                .toEqual([{ id: 1, name: 'ts_mit', generalLocation: 'CERN_186_R_E10' }])
            expect(await setup.query(
                `select id, "setupId", name, note, "configBody"::text as body, "createdAt" = current_date as today
                 from main."SvtTestSetupConfig"`,
            )).toEqual([{ id: 1, setupId: 1, name: 'ts_mit_config_v0', note: 'default config', body: SVT_TEST_CONFIG_BODY, today: true }])
            expect(await defaultRows()).toEqual([{ setupId: 1, defaultConfigId: 1 }])
        })

        it('accepts a default config without a note', async () => {
            const { defaultConfig, ...rest } = SETUP_2_CREATE
            const create = { ...rest, defaultConfig: { name: defaultConfig.name, configBody: defaultConfig.configBody } }

            const reply = await setup.send<EntityReply>({ type: 'CreateSvtTestSetup', data: { create } })

            expect(reply.status, reply.error.message).toBe('Success')
            expect(await setup.query('select note from main."SvtTestSetupConfig"')).toEqual([{ note: null }])
        })

        it('rejects a bad location, a body that is no JSON string, a duplicate config name, a missing config, an unknown key', async () => {
            await createSetup(SVT_TEST_SETUP_CREATE)
            const fresh = SETUP_2_CREATE
            const cases: [Record<string, unknown>, string][] = [
                [{ ...fresh, generalLocation: 'Moon' }, 'Moon is not a value of the wpGeneralLocation enum'],
                [
                    { ...fresh, defaultConfig: { ...fresh.defaultConfig, configBody: '{oops' } },
                    'data.create.defaultConfig.configBody must be a string holding valid JSON',
                ],
                [{ ...fresh, defaultConfig: { ...fresh.defaultConfig, configBody: { a: 1 } } }, 'configBody'],
                [{ ...fresh, defaultConfig: SVT_TEST_SETUP_CREATE.defaultConfig }, 'already exists'],
                [{ name: fresh.name, generalLocation: fresh.generalLocation }, 'defaultConfig'],
                [{ ...fresh, colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateSvtTestSetup', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await count('SvtTestSetup')).toBe(1)
            expect(await count('SvtTestSetupConfig')).toBe(1)
            expect(await count('SvtTestSetupDefaultConfig')).toBe(1)
        })

    })

    // ── UpdateSvtTestSetup ────────────────────────────────────────

    describe('UpdateSvtTestSetup', () => {

        it('makes another config of the setup the default', async () => {
            await createSetup(SVT_TEST_SETUP_CREATE)
            const config = await setup.send(new SvtDbAgentKafkaSvtTestSetupConfigs.CreateSvtTestSetupConfigMessage({
                create: { setupId: 1, name: 'ts_mit_config_v1', configBody: '{}', note: null },
            }))
            expect(config.status, config.error.message).toBe('Success')

            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestSetups.UpdateSvtTestSetupMessage({ id: 1, update: { defaultConfigId: 2 } }),
            )

            expect(reply).toMatchObject({ type: 'UpdateSvtTestSetupReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...SETUP_1, defaultConfigId: 2 } })
            expect(await defaultRows()).toEqual([{ setupId: 1, defaultConfigId: 2 }])
            expect((await getAll()).items).toEqual([{ ...SETUP_1, defaultConfigId: 2 }])
        })

        it('creates the default-config row when the setup has none (Q-U1)', async () => {
            await createSetup(SVT_TEST_SETUP_CREATE)
            await setup.query('delete from main."SvtTestSetupDefaultConfig"')

            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestSetups.UpdateSvtTestSetupMessage({ id: 1, update: { defaultConfigId: 1 } }),
            )

            expect(reply.status, reply.error.message).toBe('Success')
            expect(await defaultRows()).toEqual([{ setupId: 1, defaultConfigId: 1 }])
        })

        it('rejects a config of another setup as the default and leaves the default rows untouched (Q20)', async () => {
            await createSetup(SVT_TEST_SETUP_CREATE)
            await createSetup(SETUP_2_CREATE)

            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaSvtTestSetups.UpdateSvtTestSetupMessage({ id: 1, update: { defaultConfigId: 2 } }),
            )

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toContain('Test setup config 2 does not belong to test setup 1')
            expect(await defaultRows()).toEqual([{ setupId: 1, defaultConfigId: 1 }, { setupId: 2, defaultConfigId: 2 }])
            expect((await getAll()).items).toEqual([SETUP_1, SETUP_2])
        })

        it('answers NotFound for an unknown setup and BadRequest for an unknown config or a malformed update', async () => {
            await createSetup(SVT_TEST_SETUP_CREATE)
            await createSetup(SETUP_2_CREATE)
            const cases: [Record<string, unknown>, string, string][] = [
                [{ id: 999, update: { defaultConfigId: 1 } }, 'NotFound', 'Test setup 999 not found'],
                [{ id: 1, update: { defaultConfigId: 999 } }, 'BadRequest', 'Test setup config 999 does not exist'],
                [{ id: 1, update: {} }, 'BadRequest', 'defaultConfigId'],
                [{ id: 1, update: { defaultConfigId: 1, name: 'renamed' } }, 'BadRequest', 'name'],
            ]
            for (const [data, status, message] of cases) {
                const reply = await setup.send({ type: 'UpdateSvtTestSetup', data })
                expect(reply.status, message).toBe(status)
                expect(reply.error.message).toContain(message)
            }
            expect(await defaultRows()).toEqual([{ setupId: 1, defaultConfigId: 1 }, { setupId: 2, defaultConfigId: 2 }])
        })

    })

})
