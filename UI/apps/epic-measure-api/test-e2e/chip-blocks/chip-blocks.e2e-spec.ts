import { EpicApiPageResponse, EpicChipBlock } from 'svt-ts-types'

import { createWafer, createWaferType, expectError, expectPageQueryParams, expectStatus, TestSetup } from '../utils'


const SLDO: EpicChipBlock = { id: 1, chipId: 1, chipBlockType: 'AncMPW2_SLDO', serialNumber: 'AncMPW2_SLDO_C-1' }
const NVBG: EpicChipBlock = { id: 2, chipId: 1, chipBlockType: 'AncMPW2_NVBG', serialNumber: 'AncMPW2_NVBG_C-1' }
const CML: EpicChipBlock = { id: 3, chipId: 2, chipBlockType: 'AncMPW2_CML_TRANSCEIVER', serialNumber: 'AncMPW2_CML_TRANSCEIVER_C-2' }

type ChipBlockPage = EpicApiPageResponse<EpicChipBlock>

/**
 * The agent writes chip blocks with a new chip only behind `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` (off: the production
 * default, which the harness keeps), so this spec inserts them with SQL; listing them needs no flag.
 */
describe('Chip blocks (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await createWaferType(setup)
        await createWafer(setup)
        expectStatus(await setup.post('/api/chips/create-many', {
            generalLocation: 'CERN', items: [{ serialNumber: 'C-1', asicId: 1 }, { serialNumber: 'C-2', asicId: 2 }],
        }), 201)
        for (const block of [SLDO, NVBG, CML]) {
            await setup.query(
                'insert into main."ChipBlock" ("chipId", "blockType", "serialNumber") values ($1, $2, $3)',
                [block.chipId, block.chipBlockType, block.serialNumber],
            )
        }
    })

    async function page(query = ''): Promise<ChipBlockPage> {
        return expectStatus(await setup.get<ChipBlockPage>(`/api/chip-blocks${query}`), 200)
    }

    describe('GET /api/chip-blocks', () => {

        it('answers a page of the chip blocks in id order with the contract fields', async () => {
            const body = await page()

            expect(body).toEqual({ items: [SLDO, NVBG, CML], totalCount: 3 })
            expect(Object.keys(body.items[0])).toEqual(['id', 'chipId', 'chipBlockType', 'serialNumber'])
        })

        it('filters by ids: one, several (repeated, comma-separated, bracketed); rejects non-integers', async () => {
            expect(await page('?ids=2')).toEqual({ items: [NVBG], totalCount: 1 })
            expect(await page('?ids=2&ids=3')).toEqual({ items: [NVBG, CML], totalCount: 2 })
            expect(await page('?ids=2,3')).toEqual({ items: [NVBG, CML], totalCount: 2 })
            expect(await page('?ids[]=2&ids[]=3')).toEqual({ items: [NVBG, CML], totalCount: 2 })
            expectError(await setup.get('/api/chip-blocks?ids=one'), 400, 'each value in ids must be an integer number')
        })

        it('filters by chipId', async () => {
            expect(await page('?chipId=1')).toEqual({ items: [SLDO, NVBG], totalCount: 2 })
            expect(await page('?chipId=999')).toEqual({ items: [], totalCount: 0 })
            expectError(await setup.get('/api/chip-blocks?chipId=one'), 400, 'chipId must be a number')
        })

        it('filters by chipBlockTypes: one, several (repeated, comma-separated)', async () => {
            expect(await page('?chipBlockTypes=AncMPW2_SLDO')).toEqual({ items: [SLDO], totalCount: 1 })
            expect(await page('?chipBlockTypes=AncMPW2_SLDO&chipBlockTypes=AncMPW2_CML_TRANSCEIVER'))
                .toEqual({ items: [SLDO, CML], totalCount: 2 })
            expect(await page('?chipBlockTypes=AncMPW2_SLDO,AncMPW1_SLDO')).toEqual({ items: [SLDO], totalCount: 1 })
        })

        it('filters by a case-insensitive serial-number substring', async () => {
            expect(await page('?serialNumber=cml_transceiver')).toEqual({ items: [CML], totalCount: 1 })
            expect(await page('?serialNumber=%25')).toEqual({ items: [], totalCount: 0 })
        })

        it('combines the filters with AND', async () => {
            expect(await page('?chipId=1&chipBlockTypes=AncMPW2_NVBG')).toEqual({ items: [NVBG], totalCount: 1 })
            expect(await page('?chipId=2&chipBlockTypes=AncMPW2_NVBG')).toEqual({ items: [], totalCount: 0 })
        })

        it('pages: limit and offset, validation of both', async () => {
            await expectPageQueryParams(setup, '/api/chip-blocks', [SLDO, NVBG, CML])
        })

    })

    describe('GET /api/chip-blocks/:chipBlockId', () => {

        it('returns the one chip block; 404 for an unknown one, 400 for an id that is no number', async () => {
            expect(await setup.get('/api/chip-blocks/3')).toEqual({ status: 200, body: CML })
            expectError(await setup.get('/api/chip-blocks/999'), 404, 'ChipBlock does not exist: 999')
            expectError(await setup.get('/api/chip-blocks/one'), 400, 'numeric string is expected')
        })

    })

})
