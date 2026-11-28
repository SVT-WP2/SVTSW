// @vitest-environment node
import { Logger } from '@nestjs/common'
import { KafkaContext, KafkaParser } from '@nestjs/microservices'

import { SvtDbAgentNextReply, SvtDbAgentNextRequestDispatcher } from '../dispatch'

import { SvtDbAgentNextKafkaController } from './svt-db-agent-next-kafka.controller'


/** A context with headers as given, without NestJS's parser. */
function contextWith(headers: Record<string, Buffer | string> | undefined): KafkaContext {
    return { getMessage: () => ({ headers }) } as unknown as KafkaContext
}

/**
 * The context of a record as the agent gets it: the headers as kafkajs decodes them (a `Buffer` each, `null` for a
 * header without a value, an array for a header that the record has twice), run through NestJS's own `KafkaParser`,
 * as `ServerKafka` does. A string here stands for the `Buffer` of its text.
 */
function recordContext(headers: Record<string, Buffer | Buffer[] | string | null>): KafkaContext {
    const raw = Object.fromEntries(
        Object.entries(headers).map(([key, value]) => [key, typeof value === 'string' ? Buffer.from(value) : value]),
    )
    const message = new KafkaParser().parse({ key: null, value: Buffer.from('{}'), offset: '0', timestamp: '0', headers: raw })
    return new KafkaContext([message, 0, 'svt.db-agent.request', null as never, () => Promise.resolve(), null as never])
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

        it('hands the text of the header to the dispatcher, and logs the user', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ kafka_correlationId: 'c-3', svt_userId: '42' }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: '42' })
            expect(logLine()).toMatch(/^GetAllEnums → Success in \d+ ms user=42 \[c-3]$/)
        })

        it('decodes a header that is still a Buffer as UTF-8 (the parser keeps a value with a leading zero byte so)', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, contextWith({ svt_userId: Buffer.from('7') }))
            const zeroByte = recordContext({ svt_userId: Buffer.from([0, 0x37]) })
            await controller.handleRequest({ type: 'GetAllEnums' }, zeroByte)

            expect(dispatch).toHaveBeenNthCalledWith(1, { type: 'GetAllEnums' }, { userId: '7' })
            expect(dispatch).toHaveBeenNthCalledWith(2, { type: 'GetAllEnums' }, { userId: '\u00007' })
        })

        it('hands no value when the record has no such header, and logs user=-', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ kafka_correlationId: 'c-4' }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: undefined })
            expect(logLine()).toMatch(/ user=- \[c-4]$/)
        })

        it('hands null for a header without a value, which the dispatcher refuses: only a missing header is no user', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ svt_userId: null }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: null })
            expect(logLine()).toMatch(/ user=invalid$/)
        })

        it('hands null for JSON text that the parser has turned into an array, and does not unwrap it', async () => {
            for (const text of ['[1]', '["1"]', '[[1]]', '[ 1 ]', '[1.0]', '[1e0]']) {
                await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ svt_userId: text }))

                expect(dispatch, text).toHaveBeenLastCalledWith({ type: 'GetAllEnums' }, { userId: null })
            }
        })

        it('never throws on an object that the parser made of the header, and hands null', async () => {
            for (const text of ['{"toString":1}', '[{"toString":1}]', '{}']) {
                const value = await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ svt_userId: text }))

                expect(dispatch, text).toHaveBeenLastCalledWith({ type: 'GetAllEnums' }, { userId: null })
                expect(JSON.parse(value), text).toMatchObject({ type: 'GetAllEnumsReply' })
            }
        })

        it('hands the text of a header that the record has twice, which the parser has joined with a comma', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ svt_userId: [Buffer.from('1'), Buffer.from('2')] }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: '1,2' })
            expect(logLine()).toMatch(/ user=invalid$/)
        })

        it('hands a malformed text on for the dispatcher to refuse, and does not log it', async () => {
            await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ svt_userId: '4\n2' }))

            expect(dispatch).toHaveBeenCalledWith({ type: 'GetAllEnums' }, { userId: '4\n2' })
            expect(logLine()).toMatch(/ user=invalid$/)
        })

        it('logs the type only when it is a short text of safe characters, and hands the body on unchanged', async () => {
            const cases: [unknown, string][] = [
                [{ type: 'UpdateWpMachineLoadedWafer' }, 'UpdateWpMachineLoadedWafer'],
                [{ type: 'X\nFAKE LINE' }, '<invalid type>'],
                [{ type: 'X'.repeat(101) }, '<invalid type>'],
                [{ type: '' }, '<invalid type>'],
                [{ type: 5 }, '<no type>'],
                ['not json', '<no type>'],
            ]
            for (const [body, type] of cases) {
                log.mockClear()
                await controller.handleRequest(body, recordContext({}))

                expect(dispatch, type).toHaveBeenLastCalledWith(body, { userId: undefined })
                expect(logLine().startsWith(`${type} → Success in `), JSON.stringify(body)).toBe(true)
                expect(logLine()).not.toContain('\n')
            }
        })

        it('keeps the type of the body in a fallback reply, and logs only the safe form of it', async () => {
            dispatch.mockRejectedValue(new Error('boom'))
            const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
            try {
                const value = JSON.parse(await controller.handleRequest({ type: 'X\nFAKE' }, recordContext({}))) as SvtDbAgentNextReply

                expect(value).toMatchObject({ type: 'X\nFAKEReply', error: { message: 'Unexpected error while processing X\nFAKE' } })
                expect(String(error.mock.calls[0][0])).toBe('<invalid type>: the dispatcher threw')
                expect(logLine().startsWith('<invalid type> → UnexpectedError in ')).toBe(true)
            }
            finally {
                error.mockRestore()
            }
        })

        it('logs a correlation id only when it is a short text of safe characters', async () => {
            const cases: [Buffer | string | null, string][] = [
                ['0f8fad5b-d9cb-469f-a165-70867728950e', ' [0f8fad5b-d9cb-469f-a165-70867728950e]'],
                ['c-1]\nFAKE LINE [x', ' [invalid correlation id]'],
                ['x'.repeat(101), ' [invalid correlation id]'],
                ['[1]', ' [invalid correlation id]'],
                [null, ' [invalid correlation id]'],
            ]
            for (const [correlationId, suffix] of cases) {
                log.mockClear()
                await controller.handleRequest({ type: 'GetAllEnums' }, recordContext({ kafka_correlationId: correlationId }))

                expect(logLine().endsWith(`user=-${suffix}`), String(correlationId)).toBe(true)
                expect(logLine()).not.toContain('\n')
            }
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
