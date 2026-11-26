// @vitest-environment node
import { Logger } from '@nestjs/common'
import { KafkaContext } from '@nestjs/microservices'

import { SvtDbAgentNextReply, SvtDbAgentNextRequestDispatcher } from '../dispatch'

import { SvtDbAgentNextKafkaController } from './svt-db-agent-next-kafka.controller'


function contextWith(headers: Record<string, Buffer | string> | undefined): KafkaContext {
    return { getMessage: () => ({ headers }) } as unknown as KafkaContext
}

describe('SvtDbAgentNextKafkaController', () => {

    const reply: SvtDbAgentNextReply = { type: 'GetAllEnumsReply', status: 'Success', data: { a: [] }, error: { code: 0, message: '' } }
    let dispatch: ReturnType<typeof vi.fn>
    let controller: SvtDbAgentNextKafkaController

    beforeEach(() => {
        dispatch = vi.fn()
        controller = new SvtDbAgentNextKafkaController({ dispatch } as unknown as SvtDbAgentNextRequestDispatcher)
    })

    it('hands the payload to the dispatcher and returns the reply as a JSON string in wire key order', async () => {
        dispatch.mockResolvedValue(reply)

        const value = await controller.handleRequest({ type: 'GetAllEnums' }, contextWith({ kafka_correlationId: Buffer.from('c-1') }))

        expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: undefined })
        expect(value).toBe('{"type":"GetAllEnumsReply","status":"Success","data":{"a":[]},"error":{"code":0,"message":""}}')
    })

    describe('the header svt_userId', () => {

        let log: ReturnType<typeof vi.spyOn>

        beforeEach(() => {
            dispatch.mockResolvedValue(reply)
            log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
        })

        afterEach(() => log.mockRestore())

        function logLine(): string {
            expect(log).toHaveBeenCalledTimes(1)
            return String(log.mock.calls[0][0])
        }

        it('hands the value of a Buffer header to the dispatcher, decoded as UTF-8, and logs the user', async () => {
            const context = contextWith({ kafka_correlationId: 'c-3', svt_userId: Buffer.from('42') })

            await controller.handleRequest({ type: 'GetAllEnums' }, context)

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: '42' })
            expect(logLine()).toMatch(/^GetAllEnums → Success in \d+ ms user=42 \[c-3]$/)
        })

        it('hands the value of a string header to the dispatcher as it is', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, contextWith({ svt_userId: '7' }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: '7' })
            expect(logLine()).toMatch(/ user=7$/)
        })

        it('hands no value when the record has no such header, and logs user=-', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, contextWith({ kafka_correlationId: Buffer.from('c-4') }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: undefined })
            expect(logLine()).toMatch(/ user=- \[c-4]$/)
        })

        it('hands a malformed value on for the dispatcher to refuse, and does not log it', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, contextWith({ svt_userId: Buffer.from('4\n2') }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: '4\n2' })
            expect(logLine()).toMatch(/ user=invalid$/)
        })

        it('joins the values of a header that the record has twice, which the dispatcher then refuses', async () => {
            const headers = { svt_userId: [Buffer.from('1'), Buffer.from('2')] }
            const context = { getMessage: () => ({ headers }) } as unknown as KafkaContext

            await controller.handleRequest({ type: 'GetAllEnums' }, context)

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: '1,2' })
            expect(logLine()).toMatch(/ user=invalid$/)
        })

    })

    it('never throws: a dispatcher failure becomes an UnexpectedError envelope', async () => {
        dispatch.mockRejectedValue(new Error('boom'))

        const value = JSON.parse(await controller.handleRequest({ type: 'GetAllWafers' }, contextWith(undefined))) as SvtDbAgentNextReply

        expect(value).toEqual({
            type: 'GetAllWafersReply',
            status: 'UnexpectedError',
            data: null,
            error: { code: -1, message: 'Unexpected error while processing GetAllWafers' },
        })
    })

    it('copes with a payload that is not an envelope and with string headers', async () => {
        dispatch.mockResolvedValue({ ...reply, type: 'UnknownRequestReply', status: 'BadRequest', data: null })

        const raw = await controller.handleRequest('not json', contextWith({ kafka_correlationId: 'c-2' }))
        const value = JSON.parse(raw) as SvtDbAgentNextReply

        expect(dispatch).toHaveBeenCalledWith('not json', { userId: undefined })
        expect(value.status).toBe('BadRequest')
    })

})
