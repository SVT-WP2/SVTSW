// @vitest-environment node
import { SvtDbAgentKafkaUsers, SvtKafkaHeader } from 'svt-ts-types/kafka'

import { EpicRequestContext } from '../request-context'

import { toEpicDbAgentKafkaRecord } from './epic-db-agent-kafka-record.models'


describe('toEpicDbAgentKafkaRecord', () => {

    const message = new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: 'someone' })

    it('carries svt_userId with the user of the request context', () => {
        const record = EpicRequestContext.run(() => {
            EpicRequestContext.setUserId(42)
            return toEpicDbAgentKafkaRecord(message)
        })

        expect(record).toEqual({ value: JSON.stringify(message), headers: { [SvtKafkaHeader.UserId]: '42' } })
    })

    it('has no header at all in a request context without a user', () => {
        const record = EpicRequestContext.run(() => toEpicDbAgentKafkaRecord(message))

        expect(record).toEqual({ value: JSON.stringify(message) })
        expect(record).not.toHaveProperty('headers')
    })

    it('has no header outside a request context', () => {
        expect(toEpicDbAgentKafkaRecord(message)).toEqual({ value: JSON.stringify(message) })
    })

    it('keeps the user of each request apart, also after an await', async () => {
        const recordOf = (userId: number) => EpicRequestContext.run(async () => {
            EpicRequestContext.setUserId(userId)
            await new Promise((resolve) => setTimeout(resolve, 5))
            return toEpicDbAgentKafkaRecord(message)
        })

        const [first, second] = await Promise.all([recordOf(1), recordOf(2)])

        expect(first.headers).toEqual({ [SvtKafkaHeader.UserId]: '1' })
        expect(second.headers).toEqual({ [SvtKafkaHeader.UserId]: '2' })
    })

    it('refuses to write a user outside a request context, and a user id that is no positive integer', () => {
        expect(() => EpicRequestContext.setUserId(1)).toThrow('No request context')
        EpicRequestContext.run(() => {
            expect(() => EpicRequestContext.setUserId(0)).toThrow('positive integer')
            expect(() => EpicRequestContext.setUserId(1.5)).toThrow('positive integer')
            expect(() => EpicRequestContext.setUserId(Number.NaN)).toThrow('positive integer')
        })
    })

})
