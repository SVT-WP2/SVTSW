import { EpicApiPageResponse, EpicAsic, EpicAsicCreateRequest } from 'svt-ts-types'

import {
    createWafer,
    createWaferType,
    expectError,
    expectPageQueryParams,
    expectStatus,
    SMALL_WAFER_TYPE_CREATE,
    TestSetup,
    waferMapOfAsics,
} from '../utils'


/** The two ASICs of wafer `W-1` (`SMALL_WAFER_MAP`). */
const MOSAIX: EpicAsic = {
    id: 1,
    serialNumber: 'W-1_0_0',
    waferId: 1,
    chipId: null,
    familyType: 'MOSAIX',
    waferMapPosition: '0_0',
    quality: 'MechanicallyInteger',
}
const BABY: EpicAsic = {
    id: 2,
    serialNumber: 'W-1_0_1',
    waferId: 1,
    chipId: null,
    familyType: 'BABYMOSAIX',
    waferMapPosition: '0_1',
    quality: 'MechanicallyDamaged',
}

const MANUAL: EpicAsicCreateRequest = {
    serialNumber: 'MANUAL-1', waferId: 1, familyType: 'LAS', waferMapPosition: '9_9', quality: 'CoveredByGreenLayer',
}

type AsicPage = EpicApiPageResponse<EpicAsic>

describe('ASICs (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await createWaferType(setup)
        await createWafer(setup)
    })

    async function page(query = ''): Promise<AsicPage> {
        return expectStatus(await setup.get<AsicPage>(`/api/asics${query}`), 200)
    }

    describe('GET /api/asics', () => {

        it('answers a page { items, totalCount } of the ASICs in id order, chipId null while no chip exists', async () => {
            const body = await page()

            expect(body).toEqual({ items: [MOSAIX, BABY], totalCount: 2 })
            expect(Object.keys(body)).toEqual(['items', 'totalCount'])
            expect(Object.keys(body.items[0]))
                .toEqual(['id', 'serialNumber', 'waferId', 'chipId', 'familyType', 'waferMapPosition', 'quality'])
        })

        it('filters by waferId', async () => {
            await createWaferType(setup, { ...SMALL_WAFER_TYPE_CREATE, name: 'Small 2', engineeringRun: 'ER2' })
            await createWafer(setup, { serialNumber: 'W-2', waferTypeId: 2 })

            expect((await page('?waferId=2')).items.map((asic) => asic.serialNumber)).toEqual(['W-2_0_0', 'W-2_0_1'])
            expect(await page('?waferId=999')).toEqual({ items: [], totalCount: 0 })
            expectError(await setup.get('/api/asics?waferId=one'), 400, 'waferId must be a number')
        })

        it('filters by chipId: the ASIC a chip was diced from', async () => {
            expectStatus(await setup.post('/api/chips', { serialNumber: 'C-1', asicId: 2, generalLocation: 'CERN' }), 201)

            expect(await page()).toEqual({ items: [MOSAIX, { ...BABY, chipId: 1 }], totalCount: 2 })
            expect(await page('?chipId=1')).toEqual({ items: [{ ...BABY, chipId: 1 }], totalCount: 1 })
            expect(await page('?chipId=999')).toEqual({ items: [], totalCount: 0 })
            expectError(await setup.get('/api/asics?chipId=one'), 400, 'chipId must be a number')
        })

        it('filters by asicQuality', async () => {
            expect(await page('?asicQuality=MechanicallyDamaged')).toEqual({ items: [BABY], totalCount: 1 })
            expect(await page('?asicQuality=CoveredByGreenLayer')).toEqual({ items: [], totalCount: 0 })
        })

        it('filters by asicFamilyTypes: one, several (repeated, comma-separated, bracketed)', async () => {
            expectStatus(await setup.post('/api/asics', MANUAL), 201)
            const las = { ...MANUAL, id: 3, chipId: null }

            expect(await page('?asicFamilyTypes=BABYMOSAIX')).toEqual({ items: [BABY], totalCount: 1 })
            expect(await page('?asicFamilyTypes=BABYMOSAIX&asicFamilyTypes=LAS')).toEqual({ items: [BABY, las], totalCount: 2 })
            expect(await page('?asicFamilyTypes=BABYMOSAIX,LAS')).toEqual({ items: [BABY, las], totalCount: 2 })
            expect(await page('?asicFamilyTypes[]=BABYMOSAIX&asicFamilyTypes[]=LAS')).toEqual({ items: [BABY, las], totalCount: 2 })
            expect(await page('?asicFamilyTypes=AncMPW2')).toEqual({ items: [], totalCount: 0 })
        })

        it('answers 400 for a family type outside the asicFamilyType enum (the agent\'s message)', async () => {
            expectError(
                await setup.get('/api/asics?asicFamilyTypes=ChipBlock'), 400,
                '"ChipBlock" is not a value of the asicFamilyType enum',
            )
        })

        it('filters by a case-insensitive serial-number substring; % and _ are no wildcards', async () => {
            expect(await page('?serialNumber=_0_1')).toEqual({ items: [BABY], totalCount: 1 })
            expect(await page('?serialNumber=w-1')).toEqual({ items: [MOSAIX, BABY], totalCount: 2 })
            expect(await page('?serialNumber=%25')).toEqual({ items: [], totalCount: 0 })
            expect(await page('?serialNumber=')).toEqual({ items: [MOSAIX, BABY], totalCount: 2 })
        })

        // Finding E2E-8 (test-e2e/README.md): the global ValidationPipe strips undeclared query params (`whitelist`) without
        // rejecting them, so a misspelt filter (here the Kafka name `familyTypes` instead of `asicFamilyTypes`) lists everything.
        it('ignores a query param it does not declare and answers the unfiltered page', async () => {
            expect(await page('?familyTypes=BABYMOSAIX&quality=MechanicallyDamaged')).toEqual({ items: [MOSAIX, BABY], totalCount: 2 })
        })

        it('combines the filters with AND', async () => {
            expect(await page('?waferId=1&asicFamilyTypes=MOSAIX&asicQuality=MechanicallyInteger'))
                .toEqual({ items: [MOSAIX], totalCount: 1 })
            expect(await page('?waferId=1&asicFamilyTypes=MOSAIX&asicQuality=MechanicallyDamaged')).toEqual({ items: [], totalCount: 0 })
        })

        it('pages: limit and offset, validation of both', async () => {
            await expectPageQueryParams(setup, '/api/asics', [MOSAIX, BABY])
            expect(await page('?asicFamilyTypes=BABYMOSAIX&limit=1&offset=0')).toEqual({ items: [BABY], totalCount: 1 })
        })

        it('answers 40 ASICs without a limit (the BFF\'s default page), with the real totalCount', async () => {
            await createWaferType(setup, { ...SMALL_WAFER_TYPE_CREATE, name: 'Big', engineeringRun: 'ER2', waferMap: waferMapOfAsics(42) })
            await createWafer(setup, { serialNumber: 'W-BIG', waferTypeId: 2 })

            const body = await page()

            expect(body.totalCount).toBe(44)
            expect(body.items).toHaveLength(40)
            expect((await page('?limit=100')).items).toHaveLength(44)
        })

    })

    describe('GET /api/asics/:asicId', () => {

        it('returns the one ASIC', async () => {
            expect(await setup.get('/api/asics/2')).toEqual({ status: 200, body: BABY })
        })

        it('answers 404 for an unknown ASIC and 400 for an id that is no number', async () => {
            expectError(await setup.get('/api/asics/999'), 404, 'Asic does not exist: 999')
            expectError(await setup.get('/api/asics/one'), 400, 'numeric string is expected')
        })

    })

    describe('POST /api/asics', () => {

        it('creates a manual ASIC: 201 with the entity, chipId null', async () => {
            const response = await setup.post('/api/asics', MANUAL)

            expect(response).toEqual({ status: 201, body: { id: 3, ...MANUAL, chipId: null } })
            expect(await setup.query(
                'select "serialNumber", "waferId", "familyType", "waferMapPosition", quality from main."Asic" where id = 3',
            ))
                .toEqual([MANUAL])
        })

        it('validates the body: every member required with its type (BFF)', async () => {
            expectError(
                await setup.post('/api/asics', {}), 400,
                'serialNumber must be a string', 'waferId must be a number', 'familyType must be a string',
                'waferMapPosition must be a string', 'quality must be a string',
            )
        })

        it('maps the agent\'s rejections to 400: enum values, unknown wafer, duplicate serial; writes nothing', async () => {
            expectError(
                await setup.post('/api/asics', { ...MANUAL, familyType: 'NOT_A_TYPE' }), 400,
                'NOT_A_TYPE is not a value of the asicFamilyType enum',
            )
            expectError(await setup.post('/api/asics', { ...MANUAL, quality: 'Fine' }), 400, 'Fine is not a value of the asicQuality enum')
            expectError(await setup.post('/api/asics', { ...MANUAL, waferId: 999 }), 400, 'Wafer 999 does not exist')
            expectError(await setup.post('/api/asics', { ...MANUAL, serialNumber: MOSAIX.serialNumber }), 400, 'already exists')
            expect(await setup.count('Asic')).toBe(2)
        })

    })

})
