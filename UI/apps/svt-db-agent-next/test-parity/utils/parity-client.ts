import { randomUUID } from 'node:crypto'

import { SvtDbAgentKafka } from 'epic-api-types/kafka'
import { Consumer, Kafka, logLevel, Producer } from 'kafkajs'


export const PARITY_REPLY_TIMEOUT_MS = 20_000
const PROBE_TIMEOUT_MS = 5_000
const UNCORRELATED_POLL_MS = 200

/** The request the client repeats until the agent answers again: cheap, read-only, served by both agents. */
export const PARITY_PROBE_REQUEST = JSON.stringify({ type: 'GetAllWaferTypes', data: { filter: { ids: [1] } } })

/** A reply envelope as both agents produce it, or the raw value when it is not JSON. */
export type ParityReplyValue =
    | { type: string; status: string; data: unknown; error: { code: number; message: string } }
    | { raw: string }

/** What one request produced: a reply (with its headers), or nothing within the timeout. */
export type ParityOutcome =
    | { kind: 'reply'; headers: Record<string, string>; value: ParityReplyValue }
    | { kind: 'timeout'; afterMs: number }

/** The three conventional headers: `false` leaves one out, a string replaces its default. */
export type ParityHeaderOverrides = {
    kafka_correlationId?: string | false
    kafka_replyTopic?: string | false
    kafka_replyPartition?: string | false
}

export type ParitySendResult = {
    headers: Record<string, string>
    outcome: ParityOutcome
}

type UncorrelatedReply = {
    receivedAt: number
    outcome: ParityOutcome
}

/**
 * The Kafka side of the parity suite: one producer on `svt.db-agent.request`, one consumer on
 * `svt.db-agent.request.reply`, replies matched on `kafka_correlationId` as the BFF and WPAgent do. It knows
 * nothing about which agent answers; that is decided by whoever holds the consumer group on the broker.
 */
export class ParityClient {

    private readonly kafka: Kafka
    private readonly pending = new Map<string, (outcome: ParityOutcome) => void>()
    private readonly uncorrelated: UncorrelatedReply[] = []
    private producer?: Producer
    private consumer?: Consumer

    constructor(brokers: string[]) {
        this.kafka = new Kafka({ clientId: 'svt-db-agent-next-parity', brokers, logLevel: logLevel.NOTHING })
    }

    async connect(): Promise<void> {
        await this.ensureTopics([SvtDbAgentKafka.TopicName.Request, SvtDbAgentKafka.TopicName.RequestReply])
        const consumer = this.kafka.consumer({ groupId: `svt-db-agent-next-parity-${randomUUID()}`, sessionTimeout: 6000 })
        await consumer.connect()
        await consumer.subscribe({ topic: SvtDbAgentKafka.TopicName.RequestReply, fromBeginning: false })
        const joined = new Promise<void>((resolve) => consumer.on(consumer.events.GROUP_JOIN, () => resolve()))
        await consumer.run({
            eachMessage: ({ message }) => {
                const headers = Object.fromEntries(
                    Object.entries(message.headers ?? {}).map(([key, value]) => [key, value?.toString() ?? '']),
                )
                const outcome: ParityOutcome = { kind: 'reply', headers, value: parseReply(message.value?.toString() ?? '') }
                const correlationId = headers['kafka_correlationId']
                const resolve = correlationId ? this.pending.get(correlationId) : undefined
                if (resolve) {
                    this.pending.delete(correlationId)
                    resolve(outcome)
                }
                else {
                    this.uncorrelated.push({ receivedAt: Date.now(), outcome })
                }
                return Promise.resolve()
            },
        })
        await joined
        this.consumer = consumer
        this.producer = this.kafka.producer()
        await this.producer.connect()
    }

    async disconnect(): Promise<void> {
        await this.producer?.disconnect()
        await this.consumer?.disconnect()
    }

    /**
     * Sends one request record and waits for its reply: by correlation id, or, when the request carries none,
     * for the first reply without a known correlation id that arrives after it was sent.
     */
    async send(value: string, overrides: ParityHeaderOverrides = {}, timeoutMs = PARITY_REPLY_TIMEOUT_MS): Promise<ParitySendResult> {
        if (!this.producer) {
            throw new Error('ParityClient.connect() first')
        }
        const headers = buildHeaders(overrides)
        const correlationId = headers['kafka_correlationId']
        const sentAt = Date.now()
        const awaiting = correlationId !== undefined
            ? this.awaitCorrelated(correlationId, timeoutMs)
            : this.awaitUncorrelated(sentAt, timeoutMs)
        await this.producer.send({ topic: SvtDbAgentKafka.TopicName.Request, messages: [{ value, headers }] })
        return { headers, outcome: await awaiting }
    }

    /**
     * Repeats the probe until the agent answers, and returns how long that took. Used before the first case and
     * after every case that got no reply: the C++ agent exits on some inputs and is restarted by Docker.
     */
    async waitUntilServing(timeoutMs = 120_000): Promise<number> {
        const started = Date.now()
        let outcome: ParityOutcome = { kind: 'timeout', afterMs: 0 }
        while (outcome.kind !== 'reply') {
            if (Date.now() - started > timeoutMs) {
                throw new Error(`The agent did not answer the probe within ${timeoutMs} ms`)
            }
            outcome = (await this.send(PARITY_PROBE_REQUEST, {}, PROBE_TIMEOUT_MS)).outcome
        }
        return Date.now() - started
    }

    /** The next record on a topic (the heartbeat), parsed as JSON. */
    async readNextRecord(topic: string, timeoutMs = 15_000): Promise<unknown> {
        const consumer = this.kafka.consumer({ groupId: `svt-db-agent-next-parity-hb-${randomUUID()}`, sessionTimeout: 6000 })
        await consumer.connect()
        await consumer.subscribe({ topic, fromBeginning: false })
        try {
            return await new Promise<unknown>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error(`No record on ${topic} within ${timeoutMs} ms`)), timeoutMs)
                void consumer.run({
                    eachMessage: ({ message }) => {
                        clearTimeout(timer)
                        resolve(parseReply(message.value?.toString() ?? ''))
                        return Promise.resolve()
                    },
                })
            })
        }
        finally {
            await consumer.disconnect()
        }
    }

    private awaitCorrelated(correlationId: string, timeoutMs: number): Promise<ParityOutcome> {
        return new Promise<ParityOutcome>((resolve) => {
            const timer = setTimeout(() => {
                this.pending.delete(correlationId)
                resolve({ kind: 'timeout', afterMs: timeoutMs })
            }, timeoutMs)
            this.pending.set(correlationId, (outcome) => {
                clearTimeout(timer)
                resolve(outcome)
            })
        })
    }

    private awaitUncorrelated(sentAt: number, timeoutMs: number): Promise<ParityOutcome> {
        return new Promise<ParityOutcome>((resolve) => {
            const poll = (): void => {
                const index = this.uncorrelated.findIndex((entry) => entry.receivedAt >= sentAt)
                if (index >= 0) {
                    const [entry] = this.uncorrelated.splice(index, 1)
                    resolve(entry.outcome)
                }
                else if (Date.now() - sentAt > timeoutMs) {
                    resolve({ kind: 'timeout', afterMs: timeoutMs })
                }
                else {
                    setTimeout(poll, UNCORRELATED_POLL_MS)
                }
            }
            poll()
        })
    }

    private async ensureTopics(topics: string[]): Promise<void> {
        const admin = this.kafka.admin()
        await admin.connect()
        try {
            await admin.createTopics({
                waitForLeaders: true,
                topics: topics.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
            })
        }
        finally {
            await admin.disconnect()
        }
    }

}

function buildHeaders(overrides: ParityHeaderOverrides): Record<string, string> {
    const defaults: Record<keyof ParityHeaderOverrides, string> = {
        kafka_correlationId: randomUUID(),
        kafka_replyTopic: SvtDbAgentKafka.TopicName.RequestReply,
        kafka_replyPartition: '0',
    }
    const headers: Record<string, string> = {}
    for (const [key, fallback] of Object.entries(defaults) as [keyof ParityHeaderOverrides, string][]) {
        const override = overrides[key]
        if (override !== false) {
            headers[key] = override ?? fallback
        }
    }
    return headers
}

function parseReply(value: string): ParityReplyValue {
    try {
        return JSON.parse(value) as ParityReplyValue
    }
    catch {
        return { raw: value }
    }
}
