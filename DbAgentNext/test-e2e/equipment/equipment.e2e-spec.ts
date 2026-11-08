import { EpicEquipment, EpicEquipmentCreateRequest, EpicEquipmentLocationHistoryRecord } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaEquipment, SvtDbAgentKafkaEquipmentTypes } from 'svt-ts-types/kafka'

import { expectListPaging, TestSetup } from '../utils'


const SPECIFICATION = { vendor: 'Enclustra', firmware: '1.2.0', channels: 4 }

const CREATE: EpicEquipmentCreateRequest = {
    name: 'DAQ-0009012C0D0F341D',
    equipmentTypeId: 1,
    generalLocation: 'CERN',
    specification: JSON.stringify(SPECIFICATION, null, 2),
}

/** The reply carries the specification byte for byte as it was sent (R-7): the stored text of the `json` column. */
const EQUIPMENT_1: EpicEquipment = { id: 1, ...CREATE }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicEquipment>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicEquipment>
type HistoryReply = SvtDbAgentKafka.PageReplyMessageData<EpicEquipmentLocationHistoryRecord>
type LocationRow = { equipmentId: number; generalLocation: string; date: string; username: string | null; note: string | null }

describe('Equipment (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        const reply = await setup.send(new SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeMessage({ create: { name: 'Enclustra Card' } }))
        expect(reply.status, reply.error.message).toBe('Success')
    })

    async function createEquipment(create: EpicEquipmentCreateRequest): Promise<EpicEquipment> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaEquipment.CreateEquipmentMessage({ create }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaEquipment.GetAllEquipmentMessageData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaEquipment.GetAllEquipmentMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    function locationRows(): Promise<LocationRow[]> {
        return setup.query<LocationRow>(
            `select "equipmentId", "generalLocation", to_char(date, 'YYYY-MM-DD') as date, username, note
             from main."EquipmentLocation" order by id`,
        )
    }

    async function today(): Promise<string> {
        const [row] = await setup.query<{ today: string }>('select current_date::text as today')
        return row.today
    }

    // ── GetAllEquipment ───────────────────────────────────────────

    describe('GetAllEquipment', () => {

        it('lists the equipment in id order with the specification as a JSON string', async () => {
            await createEquipment(CREATE)
            await createEquipment({ ...CREATE, name: 'DAQ-0009012C0D0F301D', specification: '{}' })

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaEquipment.GetAllEquipmentMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllEquipmentReply', status: 'Success' })
            await expectListPaging(setup, 'GetAllEquipment', reply.data.items)
            expect(reply.data).toEqual({
                items: [EQUIPMENT_1, { ...EQUIPMENT_1, id: 2, name: 'DAQ-0009012C0D0F301D', specification: '{}' }],
                totalCount: 2,
            })
            expect(Object.keys(reply.data.items[0])).toEqual(['id', 'name', 'equipmentTypeId', 'generalLocation', 'specification'])
        })

        it('filters by ids (an empty list means all), answers an empty list without equipment and rejects an unknown key', async () => {
            expect(await getAll()).toEqual({ items: [], totalCount: 0 })
            await createEquipment(CREATE)

            expect(await getAll({ filter: { ids: [1] } })).toEqual({ items: [EQUIPMENT_1], totalCount: 1 })
            expect(await getAll({ filter: { ids: [] } })).toEqual({ items: [EQUIPMENT_1], totalCount: 1 })
            expect(await getAll({ filter: { ids: [999] } })).toEqual({ items: [], totalCount: 0 })
            const unknown = await setup.send({ type: 'GetAllEquipment', data: { filter: { equipmentTypeId: 1 } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: equipmentTypeId is not an allowed filter.' } })
        })

    })

    // ── CreateEquipment ───────────────────────────────────────────

    describe('CreateEquipment', () => {

        it('creates the equipment with its first location row and the specification stored as JSON', async () => {
            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaEquipment.CreateEquipmentMessage({ create: CREATE }))

            expect(reply).toMatchObject({ type: 'CreateEquipmentReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: EQUIPMENT_1 })
            const rows = await setup.query<{ name: string; equipmentTypeId: number; generalLocation: string; specification: string }>(
                'select name, "equipmentTypeId", "generalLocation", specification::text as specification from main."Equipment"',
            )
            expect(rows).toEqual([{ name: CREATE.name, equipmentTypeId: 1, generalLocation: 'CERN', specification: CREATE.specification }])
            expect(await locationRows()).toEqual([
                { equipmentId: 1, generalLocation: 'CERN', date: await today(), username: null, note: 'Location at creation' },
            ])
        })

        it('accepts a null specification (the Kafka contract allows it) and returns it as null', async () => {
            const reply = await setup.send<EntityReply>({ type: 'CreateEquipment', data: { create: { ...CREATE, specification: null } } })

            expect(reply.status, reply.error.message).toBe('Success')
            expect(reply.data.entity.specification).toBeNull()
            expect(await setup.query('select specification from main."Equipment"')).toEqual([{ specification: null }])
        })

        it('rejects an unknown location or type, a specification that is no JSON string, a duplicate name and an unknown key', async () => {
            await createEquipment(CREATE)
            const fresh = { ...CREATE, name: 'Other' }
            const cases: [Record<string, unknown>, string][] = [
                [{ ...fresh, generalLocation: 'Moon' }, 'Moon is not a value of the wpGeneralLocation enum'],
                [{ ...fresh, equipmentTypeId: 999 }, 'Equipment type 999 does not exist'],
                [{ ...fresh, specification: SPECIFICATION }, 'specification'],
                [{ ...fresh, specification: '{not json' }, 'data.create.specification must be a string holding valid JSON'],
                [{ ...fresh, name: CREATE.name }, 'already exists'],
                [{ ...fresh, colour: 'blue' }, 'colour'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateEquipment', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."Equipment"')).toEqual([{ n: 1 }])
            expect(await setup.query('select count(*)::int as n from main."EquipmentLocation"')).toEqual([{ n: 1 }])
        })

    })

    // ── UpdateEquipmentLocation ───────────────────────────────────

    describe('UpdateEquipmentLocation', () => {

        it('appends a history row and makes it the current location', async () => {
            const equipment = await createEquipment(CREATE)

            const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaEquipment.UpdateEquipmentLocationMessage({
                equipmentId: equipment.id, generalLocation: 'Prague', date: '2026-03-01', note: 'shipped to the lab', username: 'okorchak',
            }))

            expect(reply).toMatchObject({ type: 'UpdateEquipmentLocationReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: { ...EQUIPMENT_1, generalLocation: 'Prague' } })
            expect(await locationRows()).toEqual([
                { equipmentId: 1, generalLocation: 'CERN', date: await today(), username: null, note: 'Location at creation' },
                { equipmentId: 1, generalLocation: 'Prague', date: '2026-03-01', username: 'okorchak', note: 'shipped to the lab' },
            ])
            expect((await getAll()).items).toEqual([{ ...EQUIPMENT_1, generalLocation: 'Prague' }])
        })

        it('answers NotFound for unknown equipment and BadRequest for an unknown location or a malformed record', async () => {
            await createEquipment(CREATE)
            const notFound = await setup.send(new SvtDbAgentKafkaEquipment.UpdateEquipmentLocationMessage({
                equipmentId: 999, generalLocation: 'CERN', date: null, note: '', username: null,
            }))
            const badLocation = await setup.send(new SvtDbAgentKafkaEquipment.UpdateEquipmentLocationMessage({
                equipmentId: 1, generalLocation: 'Moon', date: null, note: '', username: null,
            }))
            const malformed = await setup.send({ type: 'UpdateEquipmentLocation', data: { equipmentId: 'one', generalLocation: 'CERN' } })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { message: 'Equipment 999 not found' } })
            expect(badLocation).toMatchObject({
                status: 'BadRequest', error: { message: 'Moon is not a value of the wpGeneralLocation enum' },
            })
            expect(malformed.status).toBe('BadRequest')
            expect(malformed.error.message).toContain('equipmentId')
            expect(await setup.query('select count(*)::int as n from main."EquipmentLocation"')).toEqual([{ n: 1 }])
        })

    })

    // ── GetEquipmentLocationHistory ───────────────────────────────

    describe('GetEquipmentLocationHistory', () => {

        it('returns the history oldest first with the five record fields', async () => {
            const equipment = await createEquipment(CREATE)
            await setup.send(new SvtDbAgentKafkaEquipment.UpdateEquipmentLocationMessage({
                equipmentId: equipment.id, generalLocation: 'Prague', date: '2026-03-01', note: 'moved', username: 'okorchak',
            }))

            const reply = await setup.send<HistoryReply>(
                new SvtDbAgentKafkaEquipment.GetEquipmentLocationHistoryMessage({ equipmentId: equipment.id }),
            )

            expect(reply).toMatchObject({ type: 'GetEquipmentLocationHistoryReply', status: 'Success' })
            expect(reply.data).toEqual({
                items: [
                    { equipmentId: 1, generalLocation: 'CERN', date: await today(), note: 'Location at creation', username: null },
                    { equipmentId: 1, generalLocation: 'Prague', date: '2026-03-01', note: 'moved', username: 'okorchak' },
                ],
                totalCount: 2,
            })
            expect(Object.keys(reply.data.items[0])).toEqual(['equipmentId', 'generalLocation', 'date', 'note', 'username'])
        })

        it('answers NotFound for unknown equipment and BadRequest without equipmentId', async () => {
            const notFound = await setup.send(new SvtDbAgentKafkaEquipment.GetEquipmentLocationHistoryMessage({ equipmentId: 999 }))
            const missing = await setup.send({ type: 'GetEquipmentLocationHistory', data: {} })

            expect(notFound).toMatchObject({ status: 'NotFound', data: null, error: { message: 'Equipment 999 not found' } })
            expect(missing).toMatchObject({ status: 'BadRequest', error: { message: 'data.equipmentId must be an integer' } })
        })

    })

})
