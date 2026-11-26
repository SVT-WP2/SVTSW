import { EpicUser, EpicUserRole } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaEquipmentTypes, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { TestSetup } from '../utils'


const HEADER_MESSAGE = 'Header svt_userId must be a positive integer'

type EntityReply = SvtDbAgentKafka.OneEntityReplyMessageData<EpicUser>

/**
 * The header `svt_userId` (`docs/messages.md` §1.5). The dispatcher checks it before the handler and hands the user
 * to the handler as `context.userId`. No handler uses it yet, so the spec spies on the definition of
 * `GetAllEquipmentTypes` to see what a handler gets.
 */
describe('The user of a request, header svt_userId (e2e)', () => {

    const setup = new TestSetup()
    const list = new SvtDbAgentKafkaEquipmentTypes.GetAllEquipmentTypesMessage({})
    let handle: ReturnType<typeof vi.spyOn>

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    beforeEach(async () => {
        await setup.clearDatabase()
        handle = vi.spyOn(setup.handlerDefinition('GetAllEquipmentTypes'), 'handle')
    })

    afterEach(() => handle.mockRestore())

    async function createUser(login: string): Promise<number> {
        const reply = await setup.send<EntityReply>(new SvtDbAgentKafkaUsers.CreateUserMessage({
            create: { login, name: login, role: EpicUserRole.User, passwordHash: `test-hash-${login}` },
        }))
        expect(reply.status, reply.error.message).toBe('Success')
        return reply.data.entity.id
    }

    it('serves a request without the header as before, and the handler gets userId null', async () => {
        const reply = await setup.send(list)

        expect(reply).toMatchObject({ type: 'GetAllEquipmentTypesReply', status: 'Success', data: { items: [], totalCount: 0 } })
        expect(handle).toHaveBeenCalledWith({}, { userId: null })
    })

    it('serves a request with the id of a user, and the handler gets the number', async () => {
        await createUser('anna')
        const bruno = await createUser('bruno')

        const reply = await setup.send(list, { userId: String(bruno) })

        expect(reply).toMatchObject({ type: 'GetAllEquipmentTypesReply', status: 'Success' })
        expect(handle).toHaveBeenCalledTimes(1)
        expect(handle).toHaveBeenCalledWith({}, { userId: bruno })
    })

    it('serves a request with the id of a user who is switched off', async () => {
        const anna = await createUser('anna')
        const switchedOff = await setup.send(new SvtDbAgentKafkaUsers.UpdateUserMessage({ id: anna, update: { isActive: false } }))
        expect(switchedOff.status, switchedOff.error.message).toBe('Success')

        const reply = await setup.send(list, { userId: String(anna) })

        expect(reply.status, reply.error.message).toBe('Success')
        expect(handle).toHaveBeenCalledWith({}, { userId: anna })
    })

    it('refuses a value that is no decimal string of a positive integer, before the handler', async () => {
        await createUser('anna')
        const values = ['abc', '0', '-1', '+1', '1.5', ' 1', '1 ', '01', '', '2147483648', '99999999999', '1\n']

        for (const userId of values) {
            const reply = await setup.send(list, { userId })

            expect(reply, JSON.stringify(userId)).toEqual({
                type: 'GetAllEquipmentTypesReply',
                status: 'BadRequest',
                data: null,
                error: { code: -1, message: HEADER_MESSAGE },
            })
        }
        expect(handle).not.toHaveBeenCalled()
    })

    it('refuses a header without text (a null value, or JSON that NestJS parsed): only a missing header is no user', async () => {
        await createUser('anna')

        const reply = await setup.send(list, { userId: null })

        expect(reply).toEqual({
            type: 'GetAllEquipmentTypesReply',
            status: 'BadRequest',
            data: null,
            error: { code: -1, message: HEADER_MESSAGE },
        })
        expect(handle).not.toHaveBeenCalled()
    })

    it('lets the handler read the user of the header fresh: the check loads no copy of it', async () => {
        // The row changes between the check of the header and the handler. A check that loaded the user would leave a
        // copy in the identity map of the request, and UpdateUser would answer with the role of that copy.
        const anna = await createUser('anna')
        const definition = setup.handlerDefinition('UpdateUser')
        const original = definition.handle
        const updateUser = vi.spyOn(definition, 'handle').mockImplementation(async (data, context) => {
            await setup.query('update main."SvtUser" set role = \'Expert\' where id = ?', [anna])
            return original(data, context)
        })
        try {
            const reply = await setup.send<EntityReply>(
                new SvtDbAgentKafkaUsers.UpdateUserMessage({ id: anna, update: { name: 'Anna R.' } }),
                { userId: String(anna) },
            )

            expect(reply.status, reply.error.message).toBe('Success')
            expect(reply.data.entity).toMatchObject({ id: anna, name: 'Anna R.', role: 'Expert' })
            expect(updateUser).toHaveBeenCalledWith({ id: anna, update: { name: 'Anna R.' } }, { userId: anna })
        }
        finally {
            updateUser.mockRestore()
        }
    })

    it('refuses the id of no user, before the handler, also at the end of the integer range', async () => {
        await createUser('anna')

        for (const userId of ['2', '2147483647']) {
            const reply = await setup.send(list, { userId })

            expect(reply).toEqual({
                type: 'GetAllEquipmentTypesReply',
                status: 'BadRequest',
                data: null,
                error: { code: -1, message: `Unknown user: ${userId}` },
            })
        }
        expect(handle).not.toHaveBeenCalled()
    })

    it('writes nothing when the header is refused', async () => {
        const create = new SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeMessage({ create: { name: 'Scope' } })

        const reply = await setup.send(create, { userId: '5' })

        expect(reply).toMatchObject({ type: 'CreateEquipmentTypeReply', status: 'BadRequest', error: { message: 'Unknown user: 5' } })
        expect(await setup.query('select count(*)::int as n from main."EquipmentType"')).toEqual([{ n: 0 }])
    })

    it('answers a malformed envelope and an unknown type as before, whatever the header holds', async () => {
        const unknown = await setup.send({ type: 'DoSomethingUnknown', data: {} }, { userId: 'abc' })
        const malformed = await setup.send({ data: {} } as unknown as { type: string }, { userId: '999' })

        expect(unknown).toEqual({
            type: 'DoSomethingUnknownReply',
            status: 'BadRequest',
            data: null,
            error: { code: -1, message: 'Unknown request type: DoSomethingUnknown' },
        })
        expect(malformed).toMatchObject({
            type: 'UnknownRequestReply',
            status: 'BadRequest',
            error: { message: 'Malformed request: missing string "type"' },
        })
    })

    it('gives a key svt_userId in the body no meaning', async () => {
        const reply = await setup.send({ type: 'GetAllEquipmentTypes', data: { svt_userId: 'abc' }, svt_userId: '1' } as { type: string })

        expect(reply.status, reply.error.message).toBe('Success')
        expect(handle).toHaveBeenCalledWith({ svt_userId: 'abc' }, { userId: null })
    })

})
