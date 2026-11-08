// @vitest-environment node
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

        expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' })
        expect(value).toBe('{"type":"GetAllEnumsReply","status":"Success","data":{"a":[]},"error":{"code":0,"message":""}}')
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

        expect(dispatch).toHaveBeenCalledWith('not json')
        expect(value.status).toBe('BadRequest')
    })

})
