import { EpicApiPageResponse, EpicChip, EpicChipCreateRequest, EpicChipLocationHistoryRecord } from 'svt-ts-types'

import {
    createWafer,
    createWaferType,
    expectError,
    expectPageQueryParams,
    expectStatus,
    repeatedQuery,
    TestSetup,
    waferMapOfAsics,
} from '../utils'


const CHIP_1: EpicChip = { id: 1, serialNumber: 'C-1', generalLocation: 'CERN', familyType: 'MOSAIX' }
const CHIP_2: EpicChip = { id: 2, serialNumber: 'C-2', generalLocation: 'Prague', familyType: 'BABYMOSAIX' }

type ChipPage = EpicApiPageResponse<EpicChip>

describe('Chips (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    /** Wafer `W-1`: ASIC 1 (MOSAIX) and ASIC 2 (BABYMOSAIX). */
    beforeEach(async () => {
        await setup.clearDatabase()
        await createWaferType(setup)
        await createWafer(setup)
    })

    async function createChip(create: EpicChipCreateRequest): Promise<EpicChip> {
        return expectStatus(await setup.post<EpicChip>('/api/chips', create), 201)
    }

    async function createBothChips(): Promise<void> {
        await createChip({ serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' })
        await createChip({ serialNumber: 'C-2', asicId: 2, generalLocation: 'Prague' })
    }

    async function page(query = ''): Promise<ChipPage> {
        return expectStatus(await setup.get<ChipPage>(`/api/chips${query}`), 200)
    }

    describe('GET /api/chips', () => {

        it('answers a page of the chips in id order, each with the family type of its ASIC', async () => {
            expect(await page()).toEqual({ items: [], totalCount: 0 })
            await createBothChips()

            const body = await page()

            expect(body).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(Object.keys(body.items[0])).toEqual(['id', 'serialNumber', 'generalLocation', 'familyType'])
        })

        it('filters by ids: one, several (repeated, comma-separated, bracketed); rejects non-integers', async () => {
            await createBothChips()

            expect(await page('?ids=2')).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await page('?ids=2&ids=1')).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await page('?ids=1,2')).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await page('?ids[]=1&ids[]=2')).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await page('?ids=999')).toEqual({ items: [], totalCount: 0 })
            expectError(await setup.get('/api/chips?ids=one'), 400, 'each value in ids must be an integer number')
        })

        it('filters by more than 20 ids (qs hands them over as an object, not an array)', async () => {
            await createBothChips()
            const ids = Array.from({ length: 25 }, (_, index) => index + 1)

            expect(await page(`?${repeatedQuery('ids', ids)}`)).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await page(`?${ids.map((id) => `ids[]=${id}`).join('&')}`)).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
        })

        it('filters by generalLocation', async () => {
            await createBothChips()

            expect(await page('?generalLocation=Prague')).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await page('?generalLocation=BNL')).toEqual({ items: [], totalCount: 0 })
        })

        it('filters by familyTypes: one, several (repeated, comma-separated); 400 outside the enum', async () => {
            await createBothChips()

            expect(await page('?familyTypes=BABYMOSAIX')).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await page('?familyTypes=BABYMOSAIX&familyTypes=MOSAIX')).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await page('?familyTypes=BABYMOSAIX,LAS')).toEqual({ items: [CHIP_2], totalCount: 1 })
            expectError(await setup.get('/api/chips?familyTypes=ChipBlock'), 400, '"ChipBlock" is not a value of the asicFamilyType enum')
        })

        it('filters by a case-insensitive serial-number substring', async () => {
            await createBothChips()

            expect(await page('?serialNumber=-2')).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await page('?serialNumber=c-')).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await page('?serialNumber=%25')).toEqual({ items: [], totalCount: 0 })
        })

        it('combines the filters with AND', async () => {
            await createBothChips()

            expect(await page('?familyTypes=MOSAIX&ids=2')).toEqual({ items: [], totalCount: 0 })
            expect(await page('?familyTypes=MOSAIX&generalLocation=CERN&serialNumber=1')).toEqual({ items: [CHIP_1], totalCount: 1 })
        })

        it('pages: limit and offset, validation of both; 40 chips without a limit', async () => {
            await createBothChips()
            await expectPageQueryParams(setup, '/api/chips', [CHIP_1, CHIP_2])

            await createWaferType(setup, {
                name: 'Big',
                engineeringRun: 'ER2',
                foundry: 'TowerSemiconductor',
                technology: 'TPSCo65',
                waferMap: waferMapOfAsics(40),
            })
            await createWafer(setup, { serialNumber: 'W-BIG', waferTypeId: 2 })
            const items = Array.from({ length: 40 }, (_, index) => ({ serialNumber: `C-BIG-${index}`, asicId: index + 3 }))
            expectStatus(await setup.post('/api/chips/create-many', { generalLocation: 'CERN', items }), 201)

            const body = await page()
            expect(body.totalCount).toBe(42)
            expect(body.items).toHaveLength(40)
        })

    })

    describe('GET /api/chips/:chipId', () => {

        it('returns the one chip; 404 for an unknown chip, 400 for an id that is no number', async () => {
            await createBothChips()

            expect(await setup.get('/api/chips/2')).toEqual({ status: 200, body: CHIP_2 })
            expectError(await setup.get('/api/chips/999'), 404, 'Chip does not exist: 999')
            expectError(await setup.get('/api/chips/one'), 400, 'numeric string is expected')
        })

    })

    describe('POST /api/chips', () => {

        it('creates the chip, links it to its ASIC and writes its first location row', async () => {
            const response = await setup.post('/api/chips', { serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' })

            expect(response).toEqual({ status: 201, body: CHIP_1 })
            expect(await setup.query('select id, "asicId", "serialNumber", "generalLocation" from main."Chip"'))
                .toEqual([{ id: 1, asicId: 1, serialNumber: 'C-1', generalLocation: 'CERN' }])
            expect(await setup.query('select "chipId", "generalLocation", date::text, note from main."ChipLocation"'))
                .toEqual([{ chipId: 1, generalLocation: 'CERN', date: await setup.today(), note: 'Location at creation' }])
            expect((await setup.get('/api/asics/1')).body).toMatchObject({ id: 1, chipId: 1 })
        })

        it('validates the body: every member required with its type (BFF)', async () => {
            expectError(
                await setup.post('/api/chips', {}), 400,
                'serialNumber must be a string', 'asicId must be a number', 'generalLocation must be a string',
            )
        })

        it('maps the agent\'s rejections to 400: location, unknown or taken ASIC, duplicate serial; writes nothing', async () => {
            await createChip({ serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' })
            const create: EpicChipCreateRequest = { serialNumber: 'C-2', asicId: 2, generalLocation: 'Prague' }

            expectError(
                await setup.post('/api/chips', { ...create, generalLocation: 'Moon' }), 400,
                'Moon is not a value of the wpGeneralLocation enum',
            )
            expectError(await setup.post('/api/chips', { ...create, asicId: 999 }), 400, 'Asic 999 does not exist')
            expectError(await setup.post('/api/chips', { ...create, asicId: 1 }), 400, 'Asic 1 already has a chip (1)')
            expectError(await setup.post('/api/chips', { ...create, serialNumber: 'C-1' }), 400, 'already exists')
            expect(await setup.count('Chip')).toBe(1)
            expect(await setup.count('ChipLocation')).toBe(1)
        })

    })

    describe('POST /api/chips/create-many', () => {

        it('creates every item at one location and answers 201 with the new chips as a plain array', async () => {
            const response = await setup.post('/api/chips/create-many', {
                generalLocation: 'BNL',
                items: [{ serialNumber: 'C-1', asicId: 1 }, { serialNumber: 'C-2', asicId: 2 }],
            })

            expect(response).toEqual({
                status: 201,
                body: [{ ...CHIP_1, generalLocation: 'BNL' }, { ...CHIP_2, generalLocation: 'BNL' }],
            })
            expect(await setup.query('select "chipId", "generalLocation", note from main."ChipLocation" order by id')).toEqual([
                { chipId: 1, generalLocation: 'BNL', note: 'Location at creation' },
                { chipId: 2, generalLocation: 'BNL', note: 'Location at creation' },
            ])
        })

        it('answers with the chips of this request only, and an empty list for no items', async () => {
            await createChip({ serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' })

            expect(await setup.post('/api/chips/create-many', { generalLocation: 'BNL', items: [{ serialNumber: 'C-2', asicId: 2 }] }))
                .toEqual({ status: 201, body: [{ ...CHIP_2, generalLocation: 'BNL' }] })
            expect(await setup.post('/api/chips/create-many', { generalLocation: 'BNL', items: [] })).toEqual({ status: 201, body: [] })
        })

        it('validates the body and every item (BFF)', async () => {
            expectError(await setup.post('/api/chips/create-many', { items: [] }), 400, 'generalLocation must be a string')
            expectError(await setup.post('/api/chips/create-many', { generalLocation: 'BNL', items: 'C-1' }), 400, 'items must be an array')
            expectError(
                await setup.post('/api/chips/create-many', { generalLocation: 'BNL', items: [{ asicId: 1 }] }), 400,
                'items.0.serialNumber must be a string',
            )
        })

        it('maps the agent\'s rejections to 400 and writes nothing: missing items, ASIC twice, taken ASIC, duplicate serial', async () => {
            await createChip({ serialNumber: 'C-0', asicId: 1, generalLocation: 'CERN' })

            expectError(await setup.post('/api/chips/create-many', { generalLocation: 'BNL' }), 400, 'data.create.items must be an array')
            expectError(
                await setup.post('/api/chips/create-many', {
                    generalLocation: 'BNL', items: [{ serialNumber: 'A', asicId: 2 }, { serialNumber: 'B', asicId: 2 }],
                }), 400,
                'Asic 2 appears more than once',
            )
            expectError(
                await setup.post('/api/chips/create-many', { generalLocation: 'BNL', items: [{ serialNumber: 'A', asicId: 1 }] }), 400,
                'Asic 1 already has a chip',
            )
            expectError(
                await setup.post('/api/chips/create-many', { generalLocation: 'BNL', items: [{ serialNumber: 'C-0', asicId: 2 }] }), 400,
                'already exists',
            )
            expect(await setup.count('Chip')).toBe(1)
        })

    })

    describe('POST /api/chips/:chipId/location', () => {

        beforeEach(() => createChip({ serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' }))

        it('moves the chip: 201 with the updated chip and a history row without username', async () => {
            const response = await setup.post('/api/chips/1/location', {
                generalLocation: 'Prague',
                note: 'moved to the lab',
                date: '2026-03-01',
            })

            expect(response).toEqual({ status: 201, body: { ...CHIP_1, generalLocation: 'Prague' } })
            expect(await setup.query(
                'select "generalLocation", to_char(date, \'YYYY-MM-DD\') as date, username, note from main."ChipLocation" order by id',
            ))
                .toEqual([
                    { generalLocation: 'CERN', date: await setup.today(), username: null, note: 'Location at creation' },
                    { generalLocation: 'Prague', date: '2026-03-01', username: null, note: 'moved to the lab' },
                ])
            expect((await page()).items).toEqual([{ ...CHIP_1, generalLocation: 'Prague' }])
        })

        it('answers 404 for an unknown chip and 400 for an unknown location or an invalid body', async () => {
            expectError(await setup.post('/api/chips/999/location', { generalLocation: 'CERN', note: '' }), 404, 'Chip 999 not found')
            expectError(await setup.post('/api/chips/1/location', { generalLocation: 'Moon', note: '' }), 400, 'Moon is not a value')
            expectError(await setup.post('/api/chips/1/location', {}), 400, 'generalLocation must be a string', 'note must be a string')
            expect(await setup.count('ChipLocation')).toBe(1)
        })

    })

    describe('GET /api/chips/:chipId/location-history', () => {

        beforeEach(() => createChip({ serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' }))

        it('returns the history oldest first as a plain array of the five record fields', async () => {
            await setup.post('/api/chips/1/location', { generalLocation: 'Prague', note: 'moved', date: '2026-03-01' })

            const history = expectStatus(await setup.get<EpicChipLocationHistoryRecord[]>('/api/chips/1/location-history'), 200)

            expect(history).toEqual([
                { chipId: 1, generalLocation: 'CERN', date: await setup.today(), note: 'Location at creation', username: null },
                { chipId: 1, generalLocation: 'Prague', date: '2026-03-01', note: 'moved', username: null },
            ])
            expect(Object.keys(history[0])).toEqual(['chipId', 'generalLocation', 'date', 'note', 'username'])
        })

        it('answers 404 for an unknown chip and 400 for an id that is no number', async () => {
            expectError(await setup.get('/api/chips/999/location-history'), 404, 'Chip 999 not found')
            expectError(await setup.get('/api/chips/one/location-history'), 400, 'numeric string is expected')
        })

    })

})
