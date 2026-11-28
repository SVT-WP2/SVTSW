// @vitest-environment node
import { ClientKafka } from '@nestjs/microservices'
import { firstValueFrom, Observable, switchMap } from 'rxjs'
import { SvtDbAgentKafkaUsers, SvtKafkaHeader } from 'svt-ts-types/kafka'

import { EpicRequestContext } from '../request-context'

import { EpicDbAgentKafkaRecord, sendEpicDbAgentRequest, toEpicDbAgentKafkaRecord } from './epic-db-agent-kafka-record.models'


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

/**
 * A Kafka client as NestJS's behaves for this purpose: `send` records the record, and every reply is delivered by a
 * consumer loop that was started in the context of the request that connected the client (here: user 1).
 */
class FakeKafkaClient {

    readonly records: EpicDbAgentKafkaRecord[] = []

    private readonly replies: (() => void)[] = []
    private readonly loop: ReturnType<typeof setInterval>

    constructor() {
        this.loop = EpicRequestContext.run(() => {
            EpicRequestContext.setUserId(1)
            return setInterval(() => {
                for (const deliver of this.replies.splice(0)) {
                    deliver()
                }
            }, 1)
        })
    }

    send<T>(topic: string, record: EpicDbAgentKafkaRecord): Observable<T> {
        this.records.push(record)
        return new Observable<T>((subscriber) => {
            this.replies.push(() => {
                subscriber.next({ status: 'Success' } as T)
                subscriber.complete()
            })
        })
    }

    close(): void {
        clearInterval(this.loop)
    }

}

describe('sendEpicDbAgentRequest', () => {

    const first = new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: 'first' })
    const second = new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login: 'second' })

    let client: FakeKafkaClient

    beforeEach(() => {
        client = new FakeKafkaClient()
    })

    afterEach(() => {
        client.close()
    })

    /** Two requests, the second sent while reacting to the reply of the first. */
    function chain(): Promise<unknown> {
        const kafka = client as unknown as ClientKafka
        return firstValueFrom(sendEpicDbAgentRequest(kafka, first).pipe(switchMap(() => sendEpicDbAgentRequest(kafka, second))))
    }

    it('gives a request sent from the reply handling of another the user of the request that started the chain', async () => {
        await EpicRequestContext.run(async () => {
            EpicRequestContext.setUserId(3)
            await chain()
        })

        expect(client.records.map((record) => record.headers)).toEqual([
            { [SvtKafkaHeader.UserId]: '3' },
            { [SvtKafkaHeader.UserId]: '3' },
        ])
    })

    it('sends no header on either request of a chain that has no user, whoever connected the client', async () => {
        await EpicRequestContext.run(() => chain())
        await chain()

        expect(client.records.map((record) => record.headers)).toEqual([undefined, undefined, undefined, undefined])
    })

    it('delivers the reply in the context of the caller', async () => {
        const kafka = client as unknown as ClientKafka

        const userId = await EpicRequestContext.run(async () => {
            EpicRequestContext.setUserId(5)
            const userOfReply = () => Promise.resolve(EpicRequestContext.getUserId())
            return firstValueFrom(sendEpicDbAgentRequest(kafka, first).pipe(switchMap(userOfReply)))
        })

        expect(userId).toBe(5)
    })

})
