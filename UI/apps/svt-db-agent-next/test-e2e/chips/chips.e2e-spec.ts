import { EpicAsic, EpicChip, EpicChipCreateRequest, EpicChipLocationHistoryRecord } from 'svt-ts-types'
import {
    SvtDbAgentKafka,
    SvtDbAgentKafkaAsics,
    SvtDbAgentKafkaChips,
    SvtDbAgentKafkaWafers,
    SvtDbAgentKafkaWaferTypes,
} from 'svt-ts-types/kafka'

import { TestSetup } from '../utils'


/** Two dies, one row: the wafer created in beforeEach yields ASIC 1 `W-1_0_0` (MOSAIX) and ASIC 2 `W-1_0_1` (BABYMOSAIX). */
const SMALL_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }, { PosInGroup: 1, FamilyType: 'BABYMOSAIX' }] },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [1],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: [0],
            }],
        },
    },
})

const MOSAIX_ASIC_ID = 1
const BABY_ASIC_ID = 2

const CHIP_1: EpicChip = { id: 1, serialNumber: 'C-1', generalLocation: 'CERN', familyType: 'MOSAIX' }
const CHIP_2: EpicChip = { id: 2, serialNumber: 'C-2', generalLocation: 'Prague', familyType: 'BABYMOSAIX' }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicChip>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicChip>
type HistoryReply = SvtDbAgentKafka.PageReplyMessageData<EpicChipLocationHistoryRecord>
type LocationRow = { chipId: number; generalLocation: string; date: string; username: string | null; note: string | null }

/** Chips with the feature flag at its default: no chip blocks are written. The flag-on path is in `chip-blocks`. */
describe('Chips (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({
            create: { name: 'Small', engineeringRun: 'ER1', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: SMALL_MAP },
        }))
        await send(new SvtDbAgentKafkaWafers.CreateWaferMessage({
            create: {
                serialNumber: 'W-1', batchNumber: 1, thinningDate: null, dicingDate: null, productionDate: null,
                waferTypeId: 1, generalLocation: 'CERN',
            },
        }))
    })

    /** Seeding through the agent; throws on a failed reply. */
    async function send(message: { type: string; data?: unknown }): Promise<void> {
        const reply = await setup.send(message)
        if (reply.status !== 'Success') {
            throw new Error(`${message.type} failed: ${reply.error.message}`)
        }
    }

    async function createChip(create: EpicChipCreateRequest): Promise<EpicChip> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaChips.CreateChipMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaChips.GetAllChipsMessageData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaChips.GetAllChipsMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    function locationRows(): Promise<LocationRow[]> {
        return setup.query<LocationRow>(
            `select "chipId", "generalLocation", to_char(date, 'YYYY-MM-DD') as date, username, note
             from main."ChipLocation" order by id`,
        )
    }

    async function today(): Promise<string> {
        const [row] = await setup.query<{ today: string }>('select current_date::text as today')
        return row.today
    }

    async function count(table: string): Promise<number> {
        const [row] = await setup.query<{ n: number }>(`select count(*)::int as n from main."${table}"`)
        return row.n
    }

    // ── GetAllChips ───────────────────────────────────────────────

    describe('GetAllChips', () => {

        it('lists the chips in id order with the family type of their ASIC', async () => {
            await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })
            await createChip({ serialNumber: 'C-2', asicId: BABY_ASIC_ID, generalLocation: 'Prague' })

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaChips.GetAllChipsMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllChipsReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'serialNumber', 'generalLocation', 'familyType'])
        })

        it('answers an empty page while there are no chips, also without data', async () => {
            expect(await getAll()).toEqual({ items: [], totalCount: 0 })
            const reply = await setup.send<ListReply>({ type: 'GetAllChips' })
            expect(reply.data).toEqual({ items: [], totalCount: 0 })
        })

        it('filters by ids, generalLocation, familyTypes and a serial-number substring', async () => {
            await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })
            await createChip({ serialNumber: 'C-2', asicId: BABY_ASIC_ID, generalLocation: 'Prague' })

            expect(await getAll({ filter: { ids: [2] } })).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await getAll({ filter: { ids: [] } })).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await getAll({ filter: { generalLocation: 'Prague' } })).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await getAll({ filter: { generalLocation: 'BNL' } })).toEqual({ items: [], totalCount: 0 })
            expect(await getAll({ filter: { familyTypes: ['BABYMOSAIX', 'LAS'] } })).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await getAll({ filter: { familyTypes: ['MOSAIX'], ids: [2] } })).toEqual({ items: [], totalCount: 0 })
            expect(await getAll({ filter: { serialNumber: '-2' } })).toEqual({ items: [CHIP_2], totalCount: 1 })
            expect(await getAll({ filter: { serialNumber: 'c-' } })).toEqual({ items: [CHIP_1, CHIP_2], totalCount: 2 })
            expect(await getAll({ filter: { serialNumber: '%' } })).toEqual({ items: [], totalCount: 0 })
        })

        it('pages database-side', async () => {
            await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })
            await createChip({ serialNumber: 'C-2', asicId: BABY_ASIC_ID, generalLocation: 'Prague' })

            expect(await getAll({ pager: { limit: 1, offset: 1 } })).toEqual({ items: [CHIP_2], totalCount: 2 })
            expect(await getAll({ pager: { limit: 1, offset: 0 }, filter: { familyTypes: ['MOSAIX'] } }))
                .toEqual({ items: [CHIP_1], totalCount: 1 })
        })

        it('rejects an unknown filter key with the C++ message, wrongly typed filters and an unknown enum value', async () => {
            const unknown = await setup.send({ type: 'GetAllChips', data: { filter: { asicId: 1 } } })
            const wrongType = await setup.send({ type: 'GetAllChips', data: { filter: { familyTypes: 'MOSAIX' } } })
            const unknownValue = await setup.send({ type: 'GetAllChips', data: { filter: { familyTypes: ['ChipBlock'] } } })

            expect(unknown).toMatchObject({
                status: 'BadRequest', data: null, error: { message: 'Error: asicId is not an allowed filter.' },
            })
            expect(wrongType).toMatchObject({
                status: 'BadRequest', error: { message: 'data.filter.familyTypes must be a list of strings' },
            })
            // the database rejects the value (SQLSTATE 22P02); the dispatcher answers BadRequest, not UnexpectedError
            expect(unknownValue).toMatchObject({
                status: 'BadRequest', data: null, error: { message: 'Error: "ChipBlock" is not a value of the asicFamilyType enum' },
            })
        })

    })

    // ── CreateChip ────────────────────────────────────────────────

    describe('CreateChip', () => {

        it('creates the chip with its first location row and, with the feature off, no blocks', async () => {
            await setup.query('insert into main."AsicFamilyTypeBlockList" values (?, ?)', ['MOSAIX', 'AncMPW2_SLDO'])

            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaChips.CreateChipMessage({
                create: { serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' },
            }))

            expect(reply).toMatchObject({ type: 'CreateChipReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: CHIP_1 })
            expect(await setup.query('select id, "asicId", "serialNumber", "generalLocation" from main."Chip"'))
                .toEqual([{ id: 1, asicId: MOSAIX_ASIC_ID, serialNumber: 'C-1', generalLocation: 'CERN' }])
            expect(await locationRows()).toEqual([
                { chipId: 1, generalLocation: 'CERN', date: await today(), username: null, note: 'Location at creation' },
            ])
            expect(await count('ChipBlock')).toBe(0)
        })

        it('links the chip to its ASIC: GetAllAsics reports the chipId', async () => {
            const chip = await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })

            const asics = await setup.send<SvtDbAgentKafka.PageReplyMessageData<EpicAsic>>(
                new SvtDbAgentKafkaAsics.GetAllAsicsMessage({ filter: { chipId: chip.id } }),
            )

            expect(asics.data.items.map((asic) => [asic.id, asic.chipId])).toEqual([[MOSAIX_ASIC_ID, chip.id]])
        })

        it('rejects an unknown location, an unknown or taken ASIC, a duplicate serial number and an unknown key', async () => {
            await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })
            const create: EpicChipCreateRequest = { serialNumber: 'C-2', asicId: BABY_ASIC_ID, generalLocation: 'Prague' }
            const cases: [Record<string, unknown>, string][] = [
                [{ ...create, generalLocation: 'Moon' }, 'Moon is not a value of the wpGeneralLocation enum'],
                [{ ...create, asicId: 999 }, 'Asic 999 does not exist'],
                [{ ...create, asicId: MOSAIX_ASIC_ID }, 'Asic 1 already has a chip (1)'],
                [{ ...create, serialNumber: 'C-1' }, 'already exists'],
                [{ ...create, colour: 'blue' }, 'colour'],
            ]
            for (const [body, message] of cases) {
                const reply = await setup.send({ type: 'CreateChip', data: { create: body } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await count('Chip')).toBe(1)
            expect(await count('ChipLocation')).toBe(1)
        })

        it('rejects a request without data.create', async () => {
            const reply = await setup.send({ type: 'CreateChip', data: {} })

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toContain('data.create')
        })

    })

    // ── CreateManyChips ───────────────────────────────────────────

    describe('CreateManyChips', () => {

        const items = [{ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID }, { serialNumber: 'C-2', asicId: BABY_ASIC_ID }]

        it('creates every item at the same location, each with its first location row', async () => {
            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaChips.CreateManyChipsMessage({
                create: { generalLocation: 'BNL', items },
            }))

            expect(reply).toMatchObject({ type: 'CreateManyChipsReply', status: 'Success' })
            expect(reply.data).toEqual({
                items: [
                    { id: 1, serialNumber: 'C-1', generalLocation: 'BNL', familyType: 'MOSAIX' },
                    { id: 2, serialNumber: 'C-2', generalLocation: 'BNL', familyType: 'BABYMOSAIX' },
                ],
                totalCount: 2,
            })
            expect(await locationRows()).toEqual([
                { chipId: 1, generalLocation: 'BNL', date: await today(), username: null, note: 'Location at creation' },
                { chipId: 2, generalLocation: 'BNL', date: await today(), username: null, note: 'Location at creation' },
            ])
        })

        it('replies with the chips of this request only, not with all chips (R-2)', async () => {
            await createChip({ serialNumber: 'C-0', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaChips.CreateManyChipsMessage({
                create: { generalLocation: 'BNL', items: [{ serialNumber: 'C-2', asicId: BABY_ASIC_ID }] },
            }))

            expect(reply.data).toEqual({
                items: [{ id: 2, serialNumber: 'C-2', generalLocation: 'BNL', familyType: 'BABYMOSAIX' }],
                totalCount: 1,
            })
            expect(await count('Chip')).toBe(2)
        })

        it('tolerates the extra top-level data.items key the C++ agent demanded (D-8)', async () => {
            const reply = await setup.send<ListReply>({
                type: 'CreateManyChips',
                data: { create: { generalLocation: 'BNL', items }, items: [] },
            })

            expect(reply.status, reply.error.message).toBe('Success')
            expect(reply.data.totalCount).toBe(2)
        })

        it('writes nothing when one item fails on a duplicate serial number', async () => {
            const reply = await setup.send(new SvtDbAgentKafkaChips.CreateManyChipsMessage({
                create: {
                    generalLocation: 'BNL',
                    items: [{ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID }, { serialNumber: 'C-1', asicId: BABY_ASIC_ID }],
                },
            }))

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toContain('already exists')
            expect(await count('Chip')).toBe(0)
            expect(await count('ChipLocation')).toBe(0)
        })

        it('rejects an ASIC listed twice, an unknown ASIC, a taken ASIC and an unknown location before writing', async () => {
            await createChip({ serialNumber: 'C-0', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })
            const twice = [{ serialNumber: 'A', asicId: BABY_ASIC_ID }, { serialNumber: 'B', asicId: BABY_ASIC_ID }]
            const cases: [Record<string, unknown>, string][] = [
                [{ generalLocation: 'BNL', items: twice }, 'Asic 2 appears more than once in data.create.items'],
                [{ generalLocation: 'BNL', items: [{ serialNumber: 'A', asicId: 999 }] }, 'Asic 999 does not exist'],
                [{ generalLocation: 'BNL', items: [{ serialNumber: 'A', asicId: MOSAIX_ASIC_ID }] }, 'Asic 1 already has a chip'],
                [{ generalLocation: 'Moon', items: [{ serialNumber: 'A', asicId: BABY_ASIC_ID }] }, 'Moon is not a value of the'],
                [{ generalLocation: 'BNL', items: [{ serialNumber: 'A', asicId: '2' }] }, 'asicId'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateManyChips', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await count('Chip')).toBe(1)
        })

        it('accepts an empty item list and rejects a missing one', async () => {
            const empty = await setup.send<ListReply>(new SvtDbAgentKafkaChips.CreateManyChipsMessage({
                create: { generalLocation: 'BNL', items: [] },
            }))
            const missing = await setup.send({ type: 'CreateManyChips', data: { create: { generalLocation: 'BNL' } } })

            expect(empty.status).toBe('Success')
            expect(empty.data).toEqual({ items: [], totalCount: 0 })
            expect(missing).toMatchObject({ status: 'BadRequest', error: { message: 'data.create.items must be an array' } })
        })

    })

    // ── UpdateChipLocation ────────────────────────────────────────

    describe('UpdateChipLocation', () => {

        it('appends a history row and makes it the current location', async () => {
            const chip = await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })

            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaChips.UpdateChipLocationMessage({
                chipId: chip.id,
                generalLocation: 'Prague',
                date: '2026-03-01',
                note: 'moved to the lab',
                username: 'okorchak',
            }))

            expect(reply).toMatchObject({ type: 'UpdateChipLocationReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...CHIP_1, generalLocation: 'Prague' } })
            expect(await locationRows()).toEqual([
                { chipId: 1, generalLocation: 'CERN', date: await today(), username: null, note: 'Location at creation' },
                { chipId: 1, generalLocation: 'Prague', date: '2026-03-01', username: 'okorchak', note: 'moved to the lab' },
            ])
            expect((await getAll()).items).toEqual([{ ...CHIP_1, generalLocation: 'Prague' }])
        })

        it('stamps today when the date is null and accepts a null username and no note', async () => {
            const chip = await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })

            const reply = await setup.send({
                type: 'UpdateChipLocation',
                data: { chipId: chip.id, generalLocation: 'BNL', date: null, username: null },
            })

            expect(reply.status, reply.error.message).toBe('Success')
            expect((await locationRows())[1])
                .toEqual({ chipId: 1, generalLocation: 'BNL', date: await today(), username: null, note: null })
        })

        it('answers NotFound for an unknown chip and BadRequest for an unknown location or a malformed record', async () => {
            const notFound = await setup.send(new SvtDbAgentKafkaChips.UpdateChipLocationMessage({
                chipId: 999, generalLocation: 'CERN', date: null, note: '', username: null,
            }))
            const badLocation = await setup.send(new SvtDbAgentKafkaChips.UpdateChipLocationMessage({
                chipId: 1, generalLocation: 'Moon', date: null, note: '', username: null,
            }))
            const malformed = await setup.send({ type: 'UpdateChipLocation', data: { chipId: 'one', generalLocation: 'CERN' } })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { message: 'Chip 999 not found' } })
            expect(badLocation).toMatchObject({
                status: 'BadRequest', error: { message: 'Moon is not a value of the wpGeneralLocation enum' },
            })
            expect(malformed.status).toBe('BadRequest')
            expect(malformed.error.message).toContain('chipId')
            expect(await count('ChipLocation')).toBe(0)
        })

    })

    // ── GetChipLocationHistory ────────────────────────────────────

    describe('GetChipLocationHistory', () => {

        it('returns the history oldest first with the five record fields', async () => {
            const chip = await createChip({ serialNumber: 'C-1', asicId: MOSAIX_ASIC_ID, generalLocation: 'CERN' })
            await send(new SvtDbAgentKafkaChips.UpdateChipLocationMessage({
                chipId: chip.id, generalLocation: 'Prague', date: '2026-03-01', note: 'moved', username: 'okorchak',
            }))

            const reply = await setup.send<HistoryReply>(new SvtDbAgentKafkaChips.GetChipLocationHistoryMessage({ chipId: chip.id }))

            expect(reply).toMatchObject({ type: 'GetChipLocationHistoryReply', status: 'Success' })
            expect(reply.data).toEqual({
                items: [
                    { chipId: 1, generalLocation: 'CERN', date: await today(), note: 'Location at creation', username: null },
                    { chipId: 1, generalLocation: 'Prague', date: '2026-03-01', note: 'moved', username: 'okorchak' },
                ],
                totalCount: 2,
            })
            expect(Object.keys(reply.data.items[0])).toEqual(['chipId', 'generalLocation', 'date', 'note', 'username'])
        })

        it('answers NotFound for an unknown chip and BadRequest without chipId', async () => {
            const notFound = await setup.send(new SvtDbAgentKafkaChips.GetChipLocationHistoryMessage({ chipId: 999 }))
            const missing = await setup.send({ type: 'GetChipLocationHistory', data: {} })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { message: 'Chip 999 not found' } })
            expect(missing).toMatchObject({ status: 'BadRequest', error: { message: 'data.chipId must be an integer' } })
        })

    })

})
