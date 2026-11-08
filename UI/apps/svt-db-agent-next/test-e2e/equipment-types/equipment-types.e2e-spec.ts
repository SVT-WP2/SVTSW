import { SvtDbAgentKafka, SvtDbAgentKafkaEquipmentTypes } from 'epic/entities'
import { EpicEquipmentType } from 'epic-api-types'

import { TestSetup } from '../utils'


const ENCLUSTRA: EpicEquipmentType = { id: 1, name: 'Enclustra Card' }
const SCOPE: EpicEquipmentType = { id: 2, name: 'Oscilloscope' }

type ListReply = SvtDbAgentKafka.PageReplyMessageData<EpicEquipmentType>
type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicEquipmentType>

describe('Equipment types (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(() => setup.clearDatabase())

    async function create(name: string): Promise<EpicEquipmentType> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeMessage({ create: { name } }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity
    }

    async function getAll(data: SvtDbAgentKafkaEquipmentTypes.GetAllEquipmentTypesMessageData = {}): Promise<ListReply> {
        const reply = await setup.send<ListReply>(new SvtDbAgentKafkaEquipmentTypes.GetAllEquipmentTypesMessage(data))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data
    }

    describe('GetAllEquipmentTypes', () => {

        it('lists the equipment types in id order, filters by ids and rejects an unknown filter key', async () => {
            await create(ENCLUSTRA.name)
            await create(SCOPE.name)

            const reply = await setup.send<ListReply>(new SvtDbAgentKafkaEquipmentTypes.GetAllEquipmentTypesMessage({}))

            expect(reply).toMatchObject({ type: 'GetAllEquipmentTypesReply', status: 'Success' })
            expect(reply.data).toEqual({ items: [ENCLUSTRA, SCOPE], totalCount: 2 })
            expect(await getAll({ filter: { ids: [2] } })).toEqual({ items: [SCOPE], totalCount: 1 })
            expect(await getAll({ filter: { ids: [] } })).toEqual({ items: [ENCLUSTRA, SCOPE], totalCount: 2 })
            const unknown = await setup.send({ type: 'GetAllEquipmentTypes', data: { filter: { name: 'x' } } })
            expect(unknown).toMatchObject({ status: 'BadRequest', error: { message: 'Error: name is not an allowed filter.' } })
        })

        it('answers an empty list while there are no equipment types, also without data', async () => {
            const reply = await setup.send<ListReply>({ type: 'GetAllEquipmentTypes' })

            expect(reply.data).toEqual({ items: [], totalCount: 0 })
        })

    })

    describe('CreateEquipmentType', () => {

        it('creates the equipment type', async () => {
            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeMessage({ create: { name: ENCLUSTRA.name } }),
            )

            expect(reply).toMatchObject({ type: 'CreateEquipmentTypeReply', status: 'Success' })
            expect(reply.data).toEqual({ entity: ENCLUSTRA })
            expect(await setup.query('select id, name from main."EquipmentType"')).toEqual([ENCLUSTRA])
        })

        it('rejects a duplicate name, a missing or non-string name, an unknown key and a missing create', async () => {
            await create(ENCLUSTRA.name)
            const cases: [unknown, string][] = [
                [{ name: ENCLUSTRA.name }, 'already exists'],
                [{}, 'name'],
                [{ name: 5 }, 'name'],
                [{ name: 'Multimeter', colour: 'blue' }, 'colour'],
                [undefined, 'data.create'],
            ]
            for (const [create, message] of cases) {
                const reply = await setup.send({ type: 'CreateEquipmentType', data: { create } })
                expect(reply.status, message).toBe('BadRequest')
                expect(reply.error.message).toContain(message)
            }
            expect(await setup.query('select count(*)::int as n from main."EquipmentType"')).toEqual([{ n: 1 }])
        })

    })

})
