import { EpicChipBlock } from 'epic-api-types'
import {
    SvtDbAgentKafka,
    SvtDbAgentKafkaChipBlocks,
    SvtDbAgentKafkaChips,
    SvtDbAgentKafkaWafers,
    SvtDbAgentKafkaWaferTypes,
} from 'epic-api-types/kafka'

import { TestSetup } from '../utils'


/** Two dies: ASIC 1 `AncMPW2-W1_0_0` (AncMPW2, three block types listed) and ASIC 2 `AncMPW2-W1_0_1` (MOSAIX, none). */
const SMALL_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'AncMPW2' }, { PosInGroup: 1, FamilyType: 'MOSAIX' }] },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: [0, 1],
            }],
        },
    },
})

const ANC_ASIC_ID = 1
const MOSAIX_ASIC_ID = 2
const ANC_CHIP_SN = 'AncMPW2-W1_0_0'

/** The dev database's block list for `AncMPW2`; the rows come back in the enum's order (SLDO, NVBG, CML). */
const ANC_BLOCK_TYPES = ['AncMPW2_SLDO', 'AncMPW2_NVBG', 'AncMPW2_CML_TRANSCEIVER']

const BLOCKS_OF_CHIP_1: EpicChipBlock[] = ANC_BLOCK_TYPES.map((blockType, index) => ({
    id: index + 1, chipId: 1, chipBlockType: blockType, serialNumber: `${blockType}_${ANC_CHIP_SN}`,
}))

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicChipBlock>
type BlockRow = { id: number; chipId: number; blockType: string; serialNumber: string }

/**
 * Chip blocks: written with the chip when `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` is on (this suite boots the
 * application with the flag; `chips.e2e-spec.ts` covers the default) and listed by `GetAllBlocks`.
 */
describe('Chip blocks (e2e, SVT_DB_AGENT_FEATURE_CHIP_BLOCKS=true)', () => {

    const setup = new TestSetup({ env: { SVT_DB_AGENT_FEATURE_CHIP_BLOCKS: 'true' } })

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({
            create: { name: 'Anc', engineeringRun: 'AncMPW2', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: SMALL_MAP },
        }))
        await send(new SvtDbAgentKafkaWafers.CreateWaferMessage({
            create: {
                serialNumber: 'AncMPW2-W1', batchNumber: 1, thinningDate: null, dicingDate: null, productionDate: null,
                waferTypeId: 1, generalLocation: 'CERN',
            },
        }))
        await setup.query(
            `insert into main."AsicFamilyTypeBlockList" ("asicFamilyType", "blockType")
             values ('AncMPW2', 'AncMPW2_CML_TRANSCEIVER'), ('AncMPW2', 'AncMPW2_SLDO'), ('AncMPW2', 'AncMPW2_NVBG')`,
        )
    })

    /** Seeding through the agent; throws on a failed reply. */
    async function send(message: { type: string; data?: unknown }): Promise<void> {
        const reply = await setup.send(message)
        if (reply.status !== 'Success') {
            throw new Error(`${message.type} failed: ${reply.error.message}`)
        }
    }

    async function createChip(serialNumber: string, asicId: number): Promise<void> {
        await send(new SvtDbAgentKafkaChips.CreateChipMessage({ create: { serialNumber, asicId, generalLocation: 'CERN' } }))
    }

    function blockRows(): Promise<BlockRow[]> {
        return setup.query<BlockRow>('select id, "chipId", "blockType", "serialNumber" from main."ChipBlock" order by id')
    }

    async function getAll(data: SvtDbAgentKafkaChipBlocks.GetAllChipBlocksMessageData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaChipBlocks.GetAllChipBlocksMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    // ── Generation with CreateChip / CreateManyChips ──────────────

    describe('block generation', () => {

        it('writes one block per listed block type, named <blockType>_<chipSerialNumber>, with the chip', async () => {
            await createChip(ANC_CHIP_SN, ANC_ASIC_ID)

            expect(await blockRows()).toEqual(ANC_BLOCK_TYPES.map((blockType, index) => ({
                id: index + 1, chipId: 1, blockType, serialNumber: `${blockType}_${ANC_CHIP_SN}`,
            })))
        })

        it('writes no block for a family type without entries', async () => {
            await createChip('AncMPW2-W1_0_1', MOSAIX_ASIC_ID)

            expect(await blockRows()).toEqual([])
        })

        it('writes the blocks of every chip of CreateManyChips', async () => {
            await send(new SvtDbAgentKafkaChips.CreateManyChipsMessage({
                create: {
                    generalLocation: 'CERN',
                    items: [{ serialNumber: 'AncMPW2-W1_0_1', asicId: MOSAIX_ASIC_ID }, { serialNumber: ANC_CHIP_SN, asicId: ANC_ASIC_ID }],
                },
            }))

            const rows = await blockRows()
            expect(rows.map((row) => row.chipId)).toEqual([2, 2, 2])
            expect(rows.map((row) => row.serialNumber)).toEqual(ANC_BLOCK_TYPES.map((blockType) => `${blockType}_${ANC_CHIP_SN}`))
        })

        it('leaves nothing behind when a block serial number is taken: chip, location and blocks are one transaction', async () => {
            await createChip('AncMPW2-W1_0_1', MOSAIX_ASIC_ID)
            await setup.query(
                'insert into main."ChipBlock" ("chipId", "blockType", "serialNumber") values (1, ?, ?)',
                ['AncMPW2_NVBG', `AncMPW2_NVBG_${ANC_CHIP_SN}`],
            )

            const reply = await setup.send(new SvtDbAgentKafkaChips.CreateChipMessage({
                create: { serialNumber: ANC_CHIP_SN, asicId: ANC_ASIC_ID, generalLocation: 'CERN' },
            }))

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toContain('already exists')
            expect(await setup.query('select count(*)::int as n from main."Chip"')).toEqual([{ n: 1 }])
            expect(await setup.query('select count(*)::int as n from main."ChipLocation"')).toEqual([{ n: 1 }])
            expect(await setup.query('select count(*)::int as n from main."ChipBlock"')).toEqual([{ n: 1 }])
        })

    })

    // ── GetAllBlocks ──────────────────────────────────────────────

    describe('GetAllBlocks', () => {

        beforeEach(async () => {
            await createChip(ANC_CHIP_SN, ANC_ASIC_ID)
        })

        it('lists the blocks in id order with the contract fields', async () => {
            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaChipBlocks.GetAllChipBlocksMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllBlocksReply', status: 'Success' })
            expect(reply.data).toEqual({ items: BLOCKS_OF_CHIP_1, totalCount: 3 })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'chipId', 'chipBlockType', 'serialNumber'])
        })

        it('filters by ids, chipId, chipBlockTypes and a serial-number substring, and pages database-side', async () => {
            const [sldo, nvbg, cml] = BLOCKS_OF_CHIP_1

            expect(await getAll({ filter: { ids: [2, 3] } })).toEqual({ items: [nvbg, cml], totalCount: 2 })
            expect(await getAll({ filter: { chipId: 1 } })).toEqual({ items: BLOCKS_OF_CHIP_1, totalCount: 3 })
            expect(await getAll({ filter: { chipId: 999 } })).toEqual({ items: [], totalCount: 0 })
            expect(await getAll({ filter: { chipBlockTypes: ['AncMPW2_SLDO', 'AncMPW1_SLDO'] } })).toEqual({ items: [sldo], totalCount: 1 })
            expect(await getAll({ filter: { serialNumber: 'cml_transceiver' } })).toEqual({ items: [cml], totalCount: 1 })
            expect(await getAll({ filter: { serialNumber: '%' } })).toEqual({ items: [], totalCount: 0 })
            expect(await getAll({ pager: { limit: 1, offset: 1 } })).toEqual({ items: [nvbg], totalCount: 3 })
        })

        it('rejects an unknown filter key with the C++ message, and wrongly typed filters', async () => {
            const unknown = await setup.send({ type: 'GetAllBlocks', data: { filter: { blockType: 'AncMPW2_SLDO' } } })
            const wrongType = await setup.send({ type: 'GetAllBlocks', data: { filter: { chipId: '1' } } })

            expect(unknown).toMatchObject({
                status: 'BadRequest', data: null, error: { message: 'Error: blockType is not an allowed filter.' },
            })
            expect(wrongType).toMatchObject({ status: 'BadRequest', error: { message: 'data.filter.chipId must be an integer' } })
        })

    })

})
