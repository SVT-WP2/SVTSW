import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { SvtDbAgentKafka, SvtDbAgentKafkaWafers, SvtDbAgentKafkaWaferTypes } from 'epic/entities'
import { EpicWafer, EpicWaferCreateRequest, EpicWaferLocationHistoryRecord } from 'epic-api-types'

import { TestSetup } from '../utils'


const ER2_MAP = readFileSync(resolve(__dirname, '../../../../../Configurations/WaferTypeMappings/ER2WaferMap_v0.json'), 'utf8')

/** Expected ASICs of a production ER2 wafer (`libs/svt-db/data/src/wafer-maps/__fixtures__`). */
type AsicFixture = {
    waferSerialNumber: string
    count: number
    sha256OfSortedLines: string
    samples: { serialNumber: string; waferMapPosition: string; familyType: string; quality: string }[]
}
const ER2_ASICS = JSON.parse(readFileSync(
    resolve(__dirname, '../../../../libs/svt-db/data/src/wafer-maps/__fixtures__/er2-HS02697-24A0.asics.json'),
    'utf8',
)) as AsicFixture

/** Two dies, one row: cheap wafers for the list and location tests. */
const SMALL_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }, { PosInGroup: 1, FamilyType: 'BABYMOSAIX' }] },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: ['All'],
            }],
        },
    },
})

const ER2_TYPE_ID = 1
const SMALL_TYPE_ID = 2
const LOCATION = 'CERN_186_R_E10'

type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWafer>
type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicWafer>
type HistoryReply = SvtDbAgentKafka.PageReplyMessageData<EpicWaferLocationHistoryRecord>
type AsicRow = { serialNumber: string; waferMapPosition: string; familyType: string; quality: string }

describe('Wafers (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        await createWaferType('ER2', 'ER2', ER2_MAP)
        await createWaferType('Small', 'ER1', SMALL_MAP)
    })

    async function createWaferType(name: string, engineeringRun: string, waferMap: string): Promise<void> {
        const reply = await setup.send(new SvtDbAgentKafkaWaferTypes.CreateWaferTypeMessage({
            create: { name, engineeringRun, foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap },
        }))
        if (reply.status !== 'Success') {
            throw new Error(`createWaferType failed: ${reply.error.message}`)
        }
    }

    const waferPayload = (overrides: Partial<EpicWaferCreateRequest> = {}): EpicWaferCreateRequest => ({
        serialNumber: 'W-SMALL-1',
        batchNumber: 7,
        thinningDate: null,
        dicingDate: null,
        productionDate: null,
        waferTypeId: SMALL_TYPE_ID,
        generalLocation: LOCATION,
        ...overrides,
    })

    /** Seeds a wafer through the agent, as a client would. */
    async function createWafer(create: EpicWaferCreateRequest): Promise<EpicWafer> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWafers.CreateWaferMessage({ create }))
        if (reply.status !== 'Success') {
            throw new Error(`createWafer failed: ${reply.error.message}`)
        }
        return reply.data.entity
    }

    async function count(table: string): Promise<number> {
        const [row] = await setup.query<{ n: number }>(`select count(*)::int as n from main."${table}"`)
        return row.n
    }

    async function today(): Promise<string> {
        const [row] = await setup.query<{ today: string }>('select current_date::text as today')
        return row.today
    }

    // ── CreateWafer ───────────────────────────────────────────────

    describe('CreateWafer', () => {

        it('creates the wafer, its first location row and every ASIC of the map in one go', async () => {
            const create = waferPayload({ serialNumber: ER2_ASICS.waferSerialNumber, batchNumber: 1, waferTypeId: ER2_TYPE_ID })

            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWafers.CreateWaferMessage({ create }))

            expect(reply).toMatchObject({ type: 'CreateWaferReply', status: 'Success', error: { code: 0, message: '' } })
            expect(reply.data).toEqual({
                entity: {
                    id: 1,
                    serialNumber: ER2_ASICS.waferSerialNumber,
                    batchNumber: 1,
                    thinningDate: null,
                    dicingDate: null,
                    productionDate: null,
                    waferTypeId: ER2_TYPE_ID,
                    generalLocation: LOCATION,
                },
            })

            const locations = await setup.query('select "waferId", "generalLocation", date::text, username, note from main."WaferLocation"')
            expect(locations).toEqual([
                { waferId: 1, generalLocation: LOCATION, date: await today(), username: null, note: 'Location at creation' },
            ])

            const asics = await setup.query<AsicRow>(
                'select "serialNumber", "waferMapPosition", "familyType", quality from main."Asic" where "waferId" = 1',
            )
            expect(asics).toHaveLength(ER2_ASICS.count)
            const lines = asics.map((asic) => `${asic.serialNumber}|${asic.waferMapPosition}|${asic.familyType}|${asic.quality}`).sort()
            expect(createHash('sha256').update(lines.join('\n')).digest('hex')).toBe(ER2_ASICS.sha256OfSortedLines)
            for (const sample of ER2_ASICS.samples) {
                expect(asics.find((asic) => asic.waferMapPosition === sample.waferMapPosition)).toEqual(sample)
            }
        })

        it('echoes the dates it was given as YYYY-MM-DD', async () => {
            const wafer = await createWafer(waferPayload({ thinningDate: '2026-01-15', dicingDate: '2026-02-01' }))

            expect(wafer).toMatchObject({ thinningDate: '2026-01-15', dicingDate: '2026-02-01', productionDate: null })
            const asics = await setup.query<AsicRow>('select "serialNumber", "waferMapPosition" from main."Asic" order by id')
            expect(asics).toEqual([
                { serialNumber: 'W-SMALL-1_0_0', waferMapPosition: '0_0' },
                { serialNumber: 'W-SMALL-1_0_1', waferMapPosition: '0_1' },
            ])
        })

        it('rejects a duplicate serial number and leaves the first wafer untouched', async () => {
            await createWafer(waferPayload())

            const reply = await setup.send(
                new SvtDbAgentKafkaWafers.CreateWaferMessage({ create: waferPayload({ batchNumber: 8 }) }),
            )

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toContain('already exists')
            expect(await count('Wafer')).toBe(1)
            expect(await count('WaferLocation')).toBe(1)
            expect(await count('Asic')).toBe(2)
        })

        it('rejects a missing or unknown location, an unknown wafer type and an unknown key, writing nothing', async () => {
            const cases: [Record<string, unknown>, string][] = [
                [waferPayload({ generalLocation: null }), 'generalLocation is required'],
                [waferPayload({ generalLocation: 'Moon' }), 'Moon is not a value of the wpGeneralLocation enum'],
                [waferPayload({ waferTypeId: 999 }), 'Wafer type 999 does not exist'],
                [{ ...waferPayload(), colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateWafer', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await count('Wafer')).toBe(0)
            expect(await count('Asic')).toBe(0)
        })

    })

    // ── GetAllWafers ──────────────────────────────────────────────

    describe('GetAllWafers', () => {

        it('returns an empty page on an empty database', async () => {
            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaWafers.GetAllWafersMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllWafersReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [], totalCount: 0 })
        })

        it('lists wafers in id order, filters by ids and pages database-side', async () => {
            const first = await createWafer(waferPayload({ serialNumber: 'W-1' }))
            const second = await createWafer(waferPayload({ serialNumber: 'W-2' }))
            const third = await createWafer(waferPayload({ serialNumber: 'W-3' }))

            const all = await setup.send<ListReply>(new SvtDbAgentKafkaWafers.GetAllWafersMessage({}))
            expect(all.data).toEqual({ items: [first, second, third], totalCount: 3 })
            expect(Object.keys(all.data.items[0])).toEqual([
                'id', 'serialNumber', 'batchNumber', 'thinningDate', 'dicingDate', 'productionDate', 'waferTypeId', 'generalLocation',
            ])

            const filtered = await setup.send<ListReply>(
                new SvtDbAgentKafkaWafers.GetAllWafersMessage({ filter: { ids: [third.id, first.id] } }),
            )
            expect(filtered.data).toEqual({ items: [first, third], totalCount: 2 })

            const page = await setup.send<ListReply>({ type: 'GetAllWafers', data: { pager: { limit: 1, offset: 1 } } })
            expect(page.data).toEqual({ items: [second], totalCount: 3 })

            const badPager = await setup.send({ type: 'GetAllWafers', data: { pager: { limit: -1 } } })
            expect(badPager.status).toBe('BadRequest')
        })

    })

    // ── UpdateWafer ───────────────────────────────────────────────

    describe('UpdateWafer', () => {

        it('updates the dates and returns the wafer', async () => {
            const wafer = await createWafer(waferPayload())

            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWafers.UpdateWaferMessage({
                id: wafer.id,
                update: { thinningDate: '2026-05-01', productionDate: '2025-12-24' },
            }))

            expect(reply).toMatchObject({ type: 'UpdateWaferReply', status: 'Success' })
            expect(reply.data.entity).toEqual({ ...wafer, thinningDate: '2026-05-01', productionDate: '2025-12-24' })
            const rows = await setup.query('select "thinningDate"::text, "dicingDate"::text, "productionDate"::text from main."Wafer"')
            expect(rows).toEqual([{ thinningDate: '2026-05-01', dicingDate: null, productionDate: '2025-12-24' }])
        })

        it('refuses to change the location through the generic update, with the C++ message', async () => {
            const wafer = await createWafer(waferPayload())

            const reply = await setup.send({ type: 'UpdateWafer', data: { id: wafer.id, update: { generalLocation: 'CERN' } } })

            expect(reply.status).toBe('BadRequest')
            expect(reply.error.message).toBe('Failed to update entry. update location is not allowed using generic update request')
        })

        it('answers NotFound for an unknown wafer and BadRequest for an unknown key', async () => {
            const notFound = await setup.send(
                new SvtDbAgentKafkaWafers.UpdateWaferMessage({ id: 999, update: { dicingDate: '2026-01-01' } }),
            )
            const unknownKey = await setup.send({ type: 'UpdateWafer', data: { id: 1, update: { serialNumber: 'X' } } })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { code: -1, message: 'Wafer 999 not found' } })
            expect(unknownKey.status).toBe('BadRequest')
            expect(unknownKey.error.message).toContain('serialNumber')
        })

    })

    // ── UpdateWaferLocation ───────────────────────────────────────

    describe('UpdateWaferLocation', () => {

        it('appends a history row and makes it the current location', async () => {
            const wafer = await createWafer(waferPayload())

            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaWafers.UpdateWaferLocationMessage({
                waferId: wafer.id,
                generalLocation: 'CERN',
                date: '2026-03-01',
                note: 'moved to the lab',
                username: 'okorchak',
            }))

            expect(reply).toMatchObject({ type: 'UpdateWaferLocationReply', status: 'Success' })
            expect(reply.data.entity).toEqual({ ...wafer, generalLocation: 'CERN' })
            const history = await setup.query('select "generalLocation", date::text, username, note from main."WaferLocation" order by id')
            expect(history).toEqual([
                { generalLocation: LOCATION, date: await today(), username: null, note: 'Location at creation' },
                { generalLocation: 'CERN', date: '2026-03-01', username: 'okorchak', note: 'moved to the lab' },
            ])
        })

        it('stamps the current day when date is null', async () => {
            const wafer = await createWafer(waferPayload())

            await setup.send(new SvtDbAgentKafkaWafers.UpdateWaferLocationMessage({
                waferId: wafer.id, generalLocation: 'CERN', date: null, note: 'n', username: null,
            }))

            const [row] = await setup.query('select date::text from main."WaferLocation" order by id desc limit 1')
            expect(row).toEqual({ date: await today() })
        })

        it('answers NotFound for an unknown wafer and BadRequest for an unknown location or a missing one', async () => {
            const notFound = await setup.send({ type: 'UpdateWaferLocation', data: { waferId: 999, generalLocation: 'CERN', note: 'n' } })
            const badEnum = await setup.send({ type: 'UpdateWaferLocation', data: { waferId: 1, generalLocation: 'Moon', note: 'n' } })
            const missing = await setup.send({ type: 'UpdateWaferLocation', data: { waferId: 1, note: 'n' } })

            expect(notFound).toMatchObject({ status: 'NotFound', error: { message: 'Wafer 999 not found' } })
            expect(badEnum).toMatchObject({ status: 'BadRequest', error: { message: 'Moon is not a value of the wpGeneralLocation enum' } })
            expect(missing.status).toBe('BadRequest')
            expect(missing.error.message).toContain('generalLocation')
        })

    })

    // ── GetWaferLocationHistory ───────────────────────────────────

    describe('GetWaferLocationHistory', () => {

        it('returns the history oldest first with the five record fields', async () => {
            const wafer = await createWafer(waferPayload())
            await setup.send(new SvtDbAgentKafkaWafers.UpdateWaferLocationMessage({
                waferId: wafer.id, generalLocation: 'CERN', date: '2026-03-01', note: 'moved', username: 'okorchak',
            }))

            const reply = await setup.send<HistoryReply>(new SvtDbAgentKafkaWafers.GetWaferLocationHistoryMessage({ waferId: wafer.id }))

            expect(reply).toMatchObject({ type: 'GetWaferLocationHistoryReply', status: 'Success' })
            expect(reply.data).toEqual({
                items: [
                    { waferId: wafer.id, generalLocation: LOCATION, date: await today(), note: 'Location at creation', username: null },
                    { waferId: wafer.id, generalLocation: 'CERN', date: '2026-03-01', note: 'moved', username: 'okorchak' },
                ],
                totalCount: 2,
            })
            expect(reply.data.items[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
        })

        it('answers NotFound for an unknown wafer and BadRequest without waferId', async () => {
            const notFound = await setup.send(new SvtDbAgentKafkaWafers.GetWaferLocationHistoryMessage({ waferId: 999 }))
            const missing = await setup.send({ type: 'GetWaferLocationHistory', data: {} })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null })
            expect(missing).toMatchObject({ status: 'BadRequest', error: { message: 'data.waferId must be an integer' } })
        })

    })

})
