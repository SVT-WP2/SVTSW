import {
    EpicSvtTestSetup,
    EpicSvtTestSetupConfig,
    EpicSvtTestTemplate,
    EpicSvtTestType,
    EpicSvtTestTypeConfig,
    EpicSvtTestTypeCreateRequest,
} from 'svt-ts-types'

import {
    expectError,
    expectStatus,
    SVT_TEST_CONFIG_BODY,
    SVT_TEST_CONFIG_BODY_JSON5,
    SVT_TEST_CONFIG_BODY_NOT_JSON5,
    SVT_TEST_SETUP_CREATE,
    SVT_TEST_TYPE_CREATE,
    TestSetup,
} from '../utils'


/** DUT types come back in the enum's order (MOSAIX, BABYMOSAIX, …, AncMPW2_SLDO), not the request's. */
const TYPE_1: EpicSvtTestType = { id: 1, name: 'Impedance Test', dutTypes: ['MOSAIX', 'BABYMOSAIX'] }
const TYPE_2_CREATE: EpicSvtTestTypeCreateRequest = {
    name: 'SLDO_DACScan',
    dutTypes: ['AncMPW2_SLDO'],
    testTypeConfig: { name: 'DACSCAN__cap_1uF__m1__dac0', configBody: '{}', note: null },
}
const TYPE_2: EpicSvtTestType = { id: 2, name: 'SLDO_DACScan', dutTypes: ['AncMPW2_SLDO'] }

const SETUP_1: EpicSvtTestSetup = { id: 1, name: 'ts_mit', defaultConfigId: 1, generalLocation: 'CERN_186_R_E10' }

const CONFIG_BODY_V1 = JSON.stringify({ emulator: { advanced_modelling: false }, boards: [] }, null, 4)

describe('SVT test catalog (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    async function createType(create: EpicSvtTestTypeCreateRequest = SVT_TEST_TYPE_CREATE): Promise<EpicSvtTestType> {
        return expectStatus(await setup.post<EpicSvtTestType>('/api/svt-test-types', create), 201)
    }

    async function createSetup(): Promise<EpicSvtTestSetup> {
        return expectStatus(await setup.post<EpicSvtTestSetup>('/api/svt-test-setups', SVT_TEST_SETUP_CREATE), 201)
    }

    // ── /api/svt-test-types ───────────────────────────────────────

    describe('GET /api/svt-test-types', () => {

        it('lists the types in id order with their DUT types in the enum order', async () => {
            expect(expectStatus(await setup.get('/api/svt-test-types'), 200)).toEqual([])
            await createType()
            await createType(TYPE_2_CREATE)

            const types = expectStatus(await setup.get<EpicSvtTestType[]>('/api/svt-test-types'), 200)

            expect(types).toEqual([TYPE_1, TYPE_2])
            expect(Object.keys(types[0])).toEqual(['id', 'name', 'dutTypes'])
        })

        it('filters by ids and by dutTypes (a type matches with any of them); combined with AND', async () => {
            await createType()
            await createType(TYPE_2_CREATE)

            expect((await setup.get('/api/svt-test-types?ids=2')).body).toEqual([TYPE_2])
            expect((await setup.get('/api/svt-test-types?ids=1,2')).body).toEqual([TYPE_1, TYPE_2])
            expect((await setup.get('/api/svt-test-types?dutTypes=AncMPW2_SLDO')).body).toEqual([TYPE_2])
            expect((await setup.get('/api/svt-test-types?dutTypes=BABYMOSAIX&dutTypes=AncMPW2_SLDO')).body).toEqual([TYPE_1, TYPE_2])
            expect((await setup.get('/api/svt-test-types?dutTypes[]=BABYMOSAIX')).body).toEqual([TYPE_1])
            expect((await setup.get('/api/svt-test-types?dutTypes=BABYMOSAIX&ids=2')).body).toEqual([])
            expectError(await setup.get('/api/svt-test-types?ids=one'), 400, 'each value in ids must be an integer number')
        })

    })

    describe('GET /api/svt-test-types/:id', () => {

        it('returns the one type; 404 for an unknown one, 400 for an id that is no number', async () => {
            await createType()

            expect(await setup.get('/api/svt-test-types/1')).toEqual({ status: 200, body: TYPE_1 })
            expectError(await setup.get('/api/svt-test-types/999'), 404, 'SvtTestType does not exist: 999')
            expectError(await setup.get('/api/svt-test-types/one'), 400, 'numeric string is expected')
        })

    })

    describe('POST /api/svt-test-types', () => {

        it('creates the type, its DUT types (deduplicated) and its first config in one go', async () => {
            const response = await setup.post('/api/svt-test-types', {
                ...SVT_TEST_TYPE_CREATE,
                dutTypes: ['BABYMOSAIX', 'MOSAIX', 'BABYMOSAIX'],
            })

            expect(response).toEqual({ status: 201, body: TYPE_1 })
            expect(await setup.query('select "dutType", "testTypeId" from main."SvtTestTypeDUTTypeList" order by "dutType"'))
                .toEqual([{ dutType: 'MOSAIX', testTypeId: 1 }, { dutType: 'BABYMOSAIX', testTypeId: 1 }])
            expect(await setup.query('select "testTypeId", name, note, "configBody"::text as body from main."SvtTestTypeConfig"'))
                .toEqual([{
                    testTypeId: 1,
                    name: 'Impedance Test common',
                    note: 'Impedance measurement common config',
                    body: SVT_TEST_CONFIG_BODY,
                }])
        })

        it('validates the body and its nested config (BFF)', async () => {
            expectError(await setup.post('/api/svt-test-types', {}), 400, 'name must be a string', 'dutTypes must be an array')
            expectError(
                await setup.post('/api/svt-test-types', { ...TYPE_2_CREATE, testTypeConfig: { name: 'x' } }), 400,
                'testTypeConfig.configBody must be a string',
            )
        })

        it('maps the agent\'s rejections to 400: DUT type, config body not JSON5, duplicate name; writes nothing', async () => {
            await createType()

            expectError(
                await setup.post('/api/svt-test-types', { ...TYPE_2_CREATE, dutTypes: ['MOSAIX', 'Moon'] }), 400,
                'Moon is not a value of the dutType enum',
            )
            const badBody = { ...TYPE_2_CREATE, testTypeConfig: { ...TYPE_2_CREATE.testTypeConfig, configBody: '{oops' } }
            expectError(await setup.post('/api/svt-test-types', badBody), 400, 'configBody must be a string holding valid JSON or JSON5')
            expectError(
                await setup.post('/api/svt-test-types', { ...TYPE_2_CREATE, name: SVT_TEST_TYPE_CREATE.name }), 400,
                'already exists',
            )
            expect(await setup.count('SvtTestType')).toBe(1)
            expect(await setup.count('SvtTestTypeConfig')).toBe(1)
        })

    })

    describe('PATCH /api/svt-test-types/:id', () => {

        beforeEach(() => createType())

        it('replaces the DUT types with the list sent; an empty list clears them', async () => {
            expect(await setup.patch('/api/svt-test-types/1', { dutTypes: ['AncMPW2_SLDO', 'MOSAIX'] }))
                .toEqual({ status: 200, body: { ...TYPE_1, dutTypes: ['MOSAIX', 'AncMPW2_SLDO'] } })
            expect(await setup.patch('/api/svt-test-types/1', { dutTypes: [] })).toEqual({ status: 200, body: { ...TYPE_1, dutTypes: [] } })
            expect(await setup.count('SvtTestTypeDUTTypeList')).toBe(0)
        })

        it('answers 404 for an unknown type, 400 for a bad DUT type or a body without dutTypes', async () => {
            expectError(await setup.patch('/api/svt-test-types/999', { dutTypes: ['MOSAIX'] }), 404, 'Test type 999 not found')
            expectError(await setup.patch('/api/svt-test-types/1', { dutTypes: ['Moon'] }), 400, 'Moon is not a value of the dutType enum')
            expectError(await setup.patch('/api/svt-test-types/1', {}), 400, 'dutTypes must be an array')
            expect(await setup.count('SvtTestTypeDUTTypeList')).toBe(2)
        })

    })

    // ── /api/svt-test-type-configs ────────────────────────────────

    describe('/api/svt-test-type-configs', () => {

        beforeEach(async () => {
            await createType()
            await createType({
                name: 'StepRamp',
                dutTypes: ['MOSAIX'],
                testTypeConfig: { name: 'StepRamp default', configBody: '{}', note: null },
            })
        })

        async function typeConfigs(): Promise<EpicSvtTestTypeConfig[]> {
            const createdAt = await setup.today()
            return [
                { id: 1, testTypeId: 1, name: 'Impedance Test common', note: 'Impedance measurement common config', createdAt },
                { id: 2, testTypeId: 2, name: 'StepRamp default', note: null, createdAt },
            ]
        }

        it('GET lists the configs in id order without their body, createdAt as YYYY-MM-DD', async () => {
            const configs = expectStatus(await setup.get<EpicSvtTestTypeConfig[]>('/api/svt-test-type-configs'), 200)

            expect(configs).toEqual(await typeConfigs())
            expect(Object.keys(configs[0])).toEqual(['id', 'testTypeId', 'name', 'note', 'createdAt'])
        })

        it('GET filters by ids and testTypeId; combined with AND', async () => {
            const [first, second] = await typeConfigs()

            expect((await setup.get('/api/svt-test-type-configs?testTypeId=2')).body).toEqual([second])
            expect((await setup.get('/api/svt-test-type-configs?ids=1')).body).toEqual([first])
            expect((await setup.get('/api/svt-test-type-configs?ids=1&ids=2')).body).toEqual([first, second])
            expect((await setup.get('/api/svt-test-type-configs?ids=1&testTypeId=2')).body).toEqual([])
            expectError(await setup.get('/api/svt-test-type-configs?testTypeId=one'), 400, 'testTypeId must be a number')
        })

        it('GET /:id returns the one config; 404 for an unknown one, 400 for an id that is no number', async () => {
            const [, second] = await typeConfigs()

            expect(await setup.get('/api/svt-test-type-configs/2')).toEqual({ status: 200, body: second })
            expectError(await setup.get('/api/svt-test-type-configs/999'), 404, 'SvtTestTypeConfig does not exist: 999')
            expectError(await setup.get('/api/svt-test-type-configs/one'), 400, 'numeric string is expected')
        })

        it('GET /:id/config-body returns the stored text byte for byte; 404 for an unknown config', async () => {
            expect(await setup.get('/api/svt-test-type-configs/1/config-body'))
                .toEqual({ status: 200, body: { id: 1, configBody: SVT_TEST_CONFIG_BODY } })
            expectError(await setup.get('/api/svt-test-type-configs/999/config-body'), 404, 'Test type config 999 not found')
            expectError(await setup.get('/api/svt-test-type-configs/one/config-body'), 400, 'numeric string is expected')
        })

        it('POST creates a config of a type, the body kept verbatim; a null or empty note is accepted', async () => {
            const response = await setup.post('/api/svt-test-type-configs', {
                testTypeId: 1,
                name: 'Impedance Test float',
                configBody: CONFIG_BODY_V1,
                note: null,
            })

            expect(response).toEqual({
                status: 201,
                body: { id: 3, testTypeId: 1, name: 'Impedance Test float', note: null, createdAt: await setup.today() },
            })
            expect(await setup.query('select "configBody"::text as body from main."SvtTestTypeConfig" where id = 3'))
                .toEqual([{ body: CONFIG_BODY_V1 }])
            expectStatus(await setup.post('/api/svt-test-type-configs', {
                testTypeId: 1,
                name: 'empty note',
                configBody: '{}',
                note: '',
            }), 201)
        })

        it('POST validates the body (BFF) and maps the agent\'s rejections to 400', async () => {
            expectError(
                await setup.post('/api/svt-test-type-configs', {}), 400,
                'testTypeId must be a number',
                'name must be a string',
                'note must be a string',
            )
            expectError(
                await setup.post('/api/svt-test-type-configs', { testTypeId: 999, name: 'x', configBody: '{}', note: null }), 400,
                'Test type 999 does not exist',
            )
            expectError(
                await setup.post('/api/svt-test-type-configs', { testTypeId: 1, name: 'x', configBody: '{oops', note: null }), 400,
                'configBody must be a string holding valid JSON or JSON5',
            )
            const duplicate = { testTypeId: 1, name: 'Impedance Test common', configBody: '{}', note: null }
            expectError(await setup.post('/api/svt-test-type-configs', duplicate), 400, 'already exists')
            expect(await setup.count('SvtTestTypeConfig')).toBe(2)
        })

    })

    // ── /api/svt-test-setups ──────────────────────────────────────

    describe('/api/svt-test-setups', () => {

        it('GET lists the setups in id order with their default config id', async () => {
            expect(expectStatus(await setup.get('/api/svt-test-setups'), 200)).toEqual([])
            await createSetup()
            expectStatus(await setup.post('/api/svt-test-setups', {
                name: 'sldo_ts_brunel', generalLocation: 'Brunel', defaultConfig: {
                    name: 'sldo_ts_brunel_config_v0',
                    configBody: '{}',
                    note: null,
                },
            }), 201)

            const setups = expectStatus(await setup.get<EpicSvtTestSetup[]>('/api/svt-test-setups'), 200)

            expect(setups).toEqual([SETUP_1, { id: 2, name: 'sldo_ts_brunel', defaultConfigId: 2, generalLocation: 'Brunel' }])
            expect(Object.keys(setups[0])).toEqual(['id', 'name', 'defaultConfigId', 'generalLocation'])
        })

        it('GET /:id returns the one setup; 404 for an unknown one, 400 for an id that is no number', async () => {
            await createSetup()

            expect(await setup.get('/api/svt-test-setups/1')).toEqual({ status: 200, body: SETUP_1 })
            expectError(await setup.get('/api/svt-test-setups/999'), 404, 'SvtTestSetup does not exist: 999')
            expectError(await setup.get('/api/svt-test-setups/one'), 400, 'numeric string is expected')
        })

        it('POST creates the setup, its first config (kept verbatim) and the default-config row', async () => {
            const response = await setup.post('/api/svt-test-setups', SVT_TEST_SETUP_CREATE)

            expect(response).toEqual({ status: 201, body: SETUP_1 })
            expect(await setup.query('select "setupId", name, note, "configBody"::text as body from main."SvtTestSetupConfig"'))
                .toEqual([{ setupId: 1, name: 'ts_mit_config_v0', note: 'default config', body: SVT_TEST_CONFIG_BODY }])
            expect(await setup.query('select "setupId", "defaultConfigId" from main."SvtTestSetupDefaultConfig"'))
                .toEqual([{ setupId: 1, defaultConfigId: 1 }])
        })

        it('POST accepts a default config without a note', async () => {
            const { note, ...withoutNote } = SVT_TEST_SETUP_CREATE.defaultConfig
            void note

            expect((await setup.post('/api/svt-test-setups', { ...SVT_TEST_SETUP_CREATE, defaultConfig: withoutNote })).status).toBe(201)
        })

        it('POST accepts a JSON5 default config and keeps it verbatim', async () => {
            const defaultConfig = { ...SVT_TEST_SETUP_CREATE.defaultConfig, configBody: SVT_TEST_CONFIG_BODY_JSON5 }

            expect(await setup.post('/api/svt-test-setups', { ...SVT_TEST_SETUP_CREATE, defaultConfig }))
                .toEqual({ status: 201, body: SETUP_1 })
            expect(await setup.get('/api/svt-test-setup-configs/1/config-body'))
                .toEqual({ status: 200, body: { id: 1, configBody: SVT_TEST_CONFIG_BODY_JSON5 } })
        })

        it('POST validates the body and its nested config (BFF) and maps the agent\'s rejections to 400', async () => {
            await createSetup()
            const fresh = { name: 'other', generalLocation: 'CERN', defaultConfig: { name: 'other_v0', configBody: '{}' } }

            expectError(
                await setup.post('/api/svt-test-setups', { name: 'x', generalLocation: 'CERN', defaultConfig: { name: 'x' } }), 400,
                'defaultConfig.configBody must be a string',
            )
            expectError(
                await setup.post('/api/svt-test-setups', { ...fresh, generalLocation: 'Moon' }), 400,
                'Moon is not a value of the wpGeneralLocation enum',
            )
            expectError(
                await setup.post('/api/svt-test-setups', { ...fresh, defaultConfig: { ...fresh.defaultConfig, configBody: '{oops' } }), 400,
                'configBody must be a string holding valid JSON or JSON5',
            )
            expectError(
                await setup.post('/api/svt-test-setups', {
                    ...fresh, defaultConfig: { ...fresh.defaultConfig, configBody: SVT_TEST_CONFIG_BODY_NOT_JSON5 },
                }), 400,
                'defaultConfig.configBody must be a string holding valid JSON or JSON5',
            )
            expectError(
                await setup.post('/api/svt-test-setups', { ...fresh, defaultConfig: SVT_TEST_SETUP_CREATE.defaultConfig }), 400,
                'already exists',
            )
            expect(await setup.count('SvtTestSetup')).toBe(1)
        })

        it('PATCH makes another config of the setup the default', async () => {
            await createSetup()
            expectStatus(await setup.post('/api/svt-test-setup-configs', {
                setupId: 1,
                name: 'ts_mit_config_v1',
                configBody: '{}',
                note: null,
            }), 201)

            expect(await setup.patch('/api/svt-test-setups/1', { defaultConfigId: 2 }))
                .toEqual({ status: 200, body: { ...SETUP_1, defaultConfigId: 2 } })
            expect(await setup.query('select "setupId", "defaultConfigId" from main."SvtTestSetupDefaultConfig"'))
                .toEqual([{ setupId: 1, defaultConfigId: 2 }])
        })

        it('PATCH answers 404 for an unknown setup and 400 for a config of another setup, an unknown one or no number', async () => {
            await createSetup()
            expectStatus(await setup.post('/api/svt-test-setups', {
                name: 'other', generalLocation: 'CERN', defaultConfig: { name: 'other_v0', configBody: '{}', note: null },
            }), 201)

            expectError(await setup.patch('/api/svt-test-setups/999', { defaultConfigId: 1 }), 404, 'Test setup 999 not found')
            expectError(
                await setup.patch('/api/svt-test-setups/1', { defaultConfigId: 2 }), 400,
                'Test setup config 2 does not belong to test setup 1',
            )
            expectError(await setup.patch('/api/svt-test-setups/1', { defaultConfigId: 999 }), 400, 'Test setup config 999 does not exist')
            expectError(await setup.patch('/api/svt-test-setups/1', {}), 400, 'defaultConfigId must be a number')
        })

    })

    // ── /api/svt-test-setup-configs ───────────────────────────────

    describe('/api/svt-test-setup-configs', () => {

        beforeEach(() => createSetup())

        async function config1(): Promise<EpicSvtTestSetupConfig> {
            return { id: 1, setupId: 1, name: 'ts_mit_config_v0', note: 'default config', createdAt: await setup.today() }
        }

        it('GET lists the configs in id order without their body, createdAt as YYYY-MM-DD', async () => {
            expectStatus(await setup.post('/api/svt-test-setup-configs', {
                setupId: 1,
                name: 'ts_mit_config_v1',
                configBody: CONFIG_BODY_V1,
                note: null,
            }), 201)

            const configs = expectStatus(await setup.get<EpicSvtTestSetupConfig[]>('/api/svt-test-setup-configs'), 200)

            expect(configs)
                .toEqual([await config1(), { id: 2, setupId: 1, name: 'ts_mit_config_v1', note: null, createdAt: await setup.today() }])
            expect(Object.keys(configs[0])).toEqual(['id', 'setupId', 'name', 'note', 'createdAt'])
        })

        it('GET /:id returns the one config; 404 for an unknown one, 400 for an id that is no number', async () => {
            expect(await setup.get('/api/svt-test-setup-configs/1')).toEqual({ status: 200, body: await config1() })
            expectError(await setup.get('/api/svt-test-setup-configs/999'), 404, 'SvtTestSetupConfig does not exist: 999')
            expectError(await setup.get('/api/svt-test-setup-configs/one'), 400, 'numeric string is expected')
        })

        it('GET /:id/config-body returns the stored text byte for byte; 404 for an unknown config', async () => {
            expect(await setup.get('/api/svt-test-setup-configs/1/config-body'))
                .toEqual({ status: 200, body: { id: 1, configBody: SVT_TEST_CONFIG_BODY } })
            expectError(await setup.get('/api/svt-test-setup-configs/999/config-body'), 404, 'Test setup config 999 not found')
        })

        it('POST creates a config of a setup, the body kept verbatim', async () => {
            const response = await setup.post('/api/svt-test-setup-configs', {
                setupId: 1,
                name: 'ts_mit_config_v1',
                configBody: CONFIG_BODY_V1,
                note: null,
            })

            expect(response)
                .toEqual({ status: 201, body: { id: 2, setupId: 1, name: 'ts_mit_config_v1', note: null, createdAt: await setup.today() } })
            expect(await setup.query('select "configBody"::text as body from main."SvtTestSetupConfig" where id = 2'))
                .toEqual([{ body: CONFIG_BODY_V1 }])
        })

        it('POST validates the body (BFF) and maps the agent\'s rejections to 400', async () => {
            expectError(
                await setup.post('/api/svt-test-setup-configs', {}), 400,
                'setupId must be a number',
                'name must be a string',
                'note must be a string',
            )
            expectError(
                await setup.post('/api/svt-test-setup-configs', { setupId: 999, name: 'x', configBody: '{}', note: null }), 400,
                'Test setup 999 does not exist',
            )
            expectError(
                await setup.post('/api/svt-test-setup-configs', { setupId: 1, name: 'x', configBody: '{oops', note: null }), 400,
                'configBody must be a string holding valid JSON or JSON5',
            )
            const duplicate = { setupId: 1, name: 'ts_mit_config_v0', configBody: '{}', note: null }
            expectError(await setup.post('/api/svt-test-setup-configs', duplicate), 400, 'already exists')
            expect(await setup.count('SvtTestSetupConfig')).toBe(1)
        })

    })

    // ── /api/svt-test-templates ───────────────────────────────────

    describe('/api/svt-test-templates', () => {

        const TEMPLATE_1: EpicSvtTestTemplate = { id: 1, dutType: 'MOSAIX', isEnabled: false, testTypeId: 1, testTypeConfigId: 1 }
        const TEMPLATE_2: EpicSvtTestTemplate = { id: 2, dutType: 'BABYMOSAIX', isEnabled: true, testTypeId: 1, testTypeConfigId: 2 }

        beforeEach(async () => {
            await createType()
            expectStatus(await setup.post('/api/svt-test-type-configs', {
                testTypeId: 1,
                name: 'Impedance Test float',
                configBody: '{}',
                note: null,
            }), 201)
        })

        async function createBothTemplates(): Promise<void> {
            expectStatus(await setup.post('/api/svt-test-templates', { dutType: 'MOSAIX', testTypeConfigId: 1, isEnabled: false }), 201)
            expectStatus(await setup.post('/api/svt-test-templates', { dutType: 'BABYMOSAIX', testTypeConfigId: 2, isEnabled: true }), 201)
        }

        it('GET lists the templates in id order with the test type of their config', async () => {
            expect(expectStatus(await setup.get('/api/svt-test-templates'), 200)).toEqual([])
            await createBothTemplates()

            const templates = expectStatus(await setup.get<EpicSvtTestTemplate[]>('/api/svt-test-templates'), 200)

            expect(templates).toEqual([TEMPLATE_1, TEMPLATE_2])
            expect(Object.keys(templates[0])).toEqual(['id', 'dutType', 'isEnabled', 'testTypeId', 'testTypeConfigId'])
        })

        it('GET filters by ids and dutTypes; combined with AND', async () => {
            await createBothTemplates()

            expect((await setup.get('/api/svt-test-templates?ids=1')).body).toEqual([TEMPLATE_1])
            expect((await setup.get('/api/svt-test-templates?dutTypes=BABYMOSAIX&dutTypes=AncMPW2_SLDO')).body).toEqual([TEMPLATE_2])
            expect((await setup.get('/api/svt-test-templates?dutTypes=MOSAIX,BABYMOSAIX')).body).toEqual([TEMPLATE_1, TEMPLATE_2])
            expect((await setup.get('/api/svt-test-templates?ids=1&dutTypes=BABYMOSAIX')).body).toEqual([])
            expectError(await setup.get('/api/svt-test-templates?ids=one'), 400, 'each value in ids must be an integer number')
        })

        it('GET /:id returns the one template; 404 for an unknown one, 400 for an id that is no number', async () => {
            await createBothTemplates()

            expect(await setup.get('/api/svt-test-templates/2')).toEqual({ status: 200, body: TEMPLATE_2 })
            expectError(await setup.get('/api/svt-test-templates/999'), 404, 'SvtTestTemplate does not exist: 999')
            expectError(await setup.get('/api/svt-test-templates/one'), 400, 'numeric string is expected')
        })

        it('POST creates the template honouring isEnabled', async () => {
            const response = await setup.post('/api/svt-test-templates', { dutType: 'MOSAIX', testTypeConfigId: 1, isEnabled: false })

            expect(response).toEqual({ status: 201, body: TEMPLATE_1 })
            expect(await setup.query('select "dutType", "testTypeConfigId", "isEnabled" from main."SvtTestTemplate"'))
                .toEqual([{ dutType: 'MOSAIX', testTypeConfigId: 1, isEnabled: false }])
        })

        it('POST validates the body (BFF) and maps the agent\'s rejections to 400', async () => {
            await createBothTemplates()

            expectError(
                await setup.post('/api/svt-test-templates', {}), 400,
                'isEnabled must be a boolean value',
                'dutType must be a string',
            )
            expectError(
                await setup.post('/api/svt-test-templates', { dutType: 'Moon', testTypeConfigId: 1, isEnabled: true }), 400,
                'Moon is not a value of the dutType enum',
            )
            expectError(
                await setup.post('/api/svt-test-templates', { dutType: 'AncMPW2_SLDO', testTypeConfigId: 999, isEnabled: true }), 400,
                'Test type config 999 does not exist',
            )
            expectError(
                await setup.post('/api/svt-test-templates', { dutType: 'MOSAIX', testTypeConfigId: 1, isEnabled: true }), 400,
                'already exists',
            )
            expect(await setup.count('SvtTestTemplate')).toBe(2)
        })

        // Finding E2E-2 (test-e2e/README.md): implicit conversion turns any string into a boolean (`'yes'`, also `'false'`, is true).
        it.fails('POST rejects an isEnabled that is no boolean', async () => {
            expectError(
                await setup.post('/api/svt-test-templates', { dutType: 'MOSAIX', testTypeConfigId: 1, isEnabled: 'false' }), 400,
                'isEnabled must be a boolean value',
            )
        })

        it('PATCH toggles isEnabled; 404 for an unknown template, 400 without isEnabled', async () => {
            await createBothTemplates()

            expect(await setup.patch('/api/svt-test-templates/1', { isEnabled: true }))
                .toEqual({ status: 200, body: { ...TEMPLATE_1, isEnabled: true } })
            expectError(await setup.patch('/api/svt-test-templates/999', { isEnabled: true }), 404, 'Test template 999 not found')
            expectError(await setup.patch('/api/svt-test-templates/1', {}), 400, 'isEnabled must be a boolean value')
        })

    })

})
