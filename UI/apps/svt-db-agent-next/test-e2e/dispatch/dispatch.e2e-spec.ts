import { TestSetup } from '../utils'


describe('Request dispatch (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    it('registers a handler for every message type this slice covers', () => {
        expect(setup.registeredTypes()).toEqual(expect.arrayContaining([
            'CreateWaferType',
            'GetAllEnums',
            'GetAllWaferTypes',
            'GetWaferTypeMap',
        ]))
    })

    it('answers an unknown request type with BadRequest instead of failing', async () => {
        const reply = await setup.send({ type: 'DoSomethingUnknown', data: {} })

        expect(reply).toEqual({
            type: 'DoSomethingUnknownReply',
            status: 'BadRequest',
            data: null,
            error: { code: -1, message: 'Unknown request type: DoSomethingUnknown' },
        })
    })

    it('answers a malformed envelope with BadRequest', async () => {
        const reply = await setup.send({ data: { id: 1 } } as unknown as { type: string })

        expect(reply.status).toBe('BadRequest')
        expect(reply.data).toBeNull()
        expect(reply.error.message).toContain('missing string "type"')
    })

    it('puts the wire keys in the C++ order: type, status, data, error', async () => {
        const reply = await setup.send({ type: 'GetAllEnums' })

        expect(Object.keys(reply)).toEqual(['type', 'status', 'data', 'error'])
        expect(reply.error).toEqual({ code: 0, message: '' })
    })

})
