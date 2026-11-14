import { randomUUID } from 'node:crypto'

import { Consumer, Kafka, logLevel, Producer } from 'kafkajs'
import { SvtDbAgentKafka } from 'svt-ts-types/kafka'

import { SvtDbAgentNextReply } from '../../src/modules/dispatch'
import { SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC, SVT_DB_AGENT_NEXT_KAFKA_CONSUMER_GROUP } from '../../src/modules/kafka'
import { TestSetup } from '../utils'


/**
 * The only spec that needs a broker: set `SVT_DB_AGENT_E2E_KAFKA=1` with Kafka listening where `.env.test`
 * says (`Dev/docker-compose.kafka-local.yml`, `localhost:9085`). It plays a client (kafkajs, the headers of
 * `Documentation/Kafka/SvtKafkaConventions.md`) against the agent's real Kafka microservice: envelope,
 * correlation, a non-envelope value, a write, the skip of a backlog, and the heartbeat. Everything else about the messages is
 * covered by the dispatcher-level specs, which need no broker.
 */
const describeWithBroker = process.env.SVT_DB_AGENT_E2E_KAFKA === '1' ? describe : describe.skip

const REPLY_TIMEOUT_MS = 15_000

const SMALL_MAP = JSON.stringify({
    Groups: { Group_0: [{ PosInGroup: 0, FamilyType: 'MOSAIX' }] },
    MapGroups: {
        MapGroupsRow0: {
            MapGroupsColumns: [{
                GroupName: 'Group_0',
                ExistingAsics: ['All'],
                MechanicallyDamagedASICs: [],
                ASICsCoveredByGreenLayer: [],
                MechanicallyIntegerASICs: [0],
            }],
        },
    },
})

describeWithBroker('Kafka transport (e2e, broker-backed)', () => {

    const setup = new TestSetup({ kafka: true })
    const brokers = [`${process.env.SVT_DB_AGENT_KAFKA_SERVER}:${process.env.SVT_DB_AGENT_KAFKA_PORT}`]
    const kafka = new Kafka({ clientId: 'svt-db-agent-next-e2e', brokers, logLevel: logLevel.NOTHING })
    const replies = new Map<string, (reply: SvtDbAgentNextReply) => void>()
    let producer: Producer
    let replyConsumer: Consumer
    /** Set when a reply to the request produced before the agent started arrives: it must not. */
    let backlogAnswered = false

    beforeAll(async () => {
        await ensureTopics([SvtDbAgentKafka.TopicName.Request, SvtDbAgentKafka.TopicName.RequestReply])
        replyConsumer = kafka.consumer({ groupId: `svt-db-agent-next-e2e-${randomUUID()}`, sessionTimeout: 6000 })
        await replyConsumer.connect()
        await replyConsumer.subscribe({ topic: SvtDbAgentKafka.TopicName.RequestReply, fromBeginning: false })
        const joined = new Promise<void>((resolve) => replyConsumer.on(replyConsumer.events.GROUP_JOIN, () => resolve()))
        await replyConsumer.run({
            eachMessage: ({ message }) => {
                const correlationId = message.headers?.['kafka_correlationId']?.toString()
                const resolve = correlationId ? replies.get(correlationId) : undefined
                if (resolve && message.value) {
                    replies.delete(correlationId)
                    resolve(JSON.parse(message.value.toString()) as SvtDbAgentNextReply)
                }
                return Promise.resolve()
            },
        })
        await joined
        producer = kafka.producer()
        await producer.connect()
        // A backlog as a previous run leaves it: the group committed up to the end, then a write was produced while
        // no agent consumed. Without the skip at start the agent would execute it (kafkajs resumes from the
        // committed offset); the C++ agent seeks to the end.
        await commitGroupAtEnd()
        const backlogId = await produce(JSON.stringify({ type: 'CreateEquipmentType', data: { create: { name: 'Backlog' } } }))
        replies.set(backlogId, () => {
            backlogAnswered = true
        })
        await setup.init()
    }, 60_000)

    afterAll(async () => {
        await setup.close()
        await producer?.disconnect()
        await replyConsumer?.disconnect()
    })

    beforeEach(() => setup.clearDatabase())

    async function ensureTopics(topics: string[]): Promise<void> {
        const admin = kafka.admin()
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

    /** Moves the agent's consumer group to the end of the request topic; the group must have no member. */
    async function commitGroupAtEnd(): Promise<void> {
        const admin = kafka.admin()
        await admin.connect()
        try {
            const topic = SvtDbAgentKafka.TopicName.Request
            const ends = await admin.fetchTopicOffsets(topic)
            await admin.setOffsets({
                groupId: SVT_DB_AGENT_NEXT_KAFKA_CONSUMER_GROUP,
                topic,
                partitions: ends.map((end) => ({ partition: end.partition, offset: end.offset })),
            })
        }
        finally {
            await admin.disconnect()
        }
    }

    /** Produces one request record the way the BFF and WPAgent do; returns its correlation id. */
    async function produce(value: string, correlationId = randomUUID()): Promise<string> {
        await producer.send({
            topic: SvtDbAgentKafka.TopicName.Request,
            messages: [{
                value,
                headers: {
                    kafka_correlationId: correlationId,
                    kafka_replyTopic: SvtDbAgentKafka.TopicName.RequestReply,
                    kafka_replyPartition: '0',
                },
            }],
        })
        return correlationId
    }

    /** Sends one request record and waits for the reply with its correlation id. */
    async function request(value: string): Promise<SvtDbAgentNextReply> {
        const correlationId = randomUUID()
        const reply = new Promise<SvtDbAgentNextReply>((resolve, reject) => {
            replies.set(correlationId, resolve)
            setTimeout(() => {
                replies.delete(correlationId)
                reject(new Error(`No reply for ${correlationId} within ${REPLY_TIMEOUT_MS} ms`))
            }, REPLY_TIMEOUT_MS)
        })
        await produce(value, correlationId)
        return reply
    }

    it('skips a request produced while no agent consumed the topic, as the C++ agent does', async () => {
        // One partition, in order: had the agent replayed the backlog, its reply would have come before this one.
        const reply = await request(JSON.stringify({ type: 'GetAllEquipmentTypes' }))

        expect(reply).toMatchObject({ status: 'Success' })
        expect(backlogAnswered).toBe(false)
    })

    it('answers a request on the reply topic with the envelope, matched by correlation id', async () => {
        const reply = await request(JSON.stringify({ type: 'GetAllEnums', data: { filter: { enumNames: ['dutEntityName'] } } }))

        expect(reply).toEqual({
            type: 'GetAllEnumsReply',
            status: 'Success',
            data: { dutEntityName: ['Asic', 'Chip', 'ChipBlock'] },
            error: { code: 0, message: '' },
        })
    })

    it('answers an unknown type and a value that is no envelope with BadRequest, and keeps serving', async () => {
        const unknown = await request(JSON.stringify({ type: 'DoSomethingUnknown', data: {} }))
        const notJson = await request('this is not json')
        const afterwards = await request(JSON.stringify({ type: 'GetAllWafers' }))

        expect(unknown).toMatchObject({ type: 'DoSomethingUnknownReply', status: 'BadRequest', data: null })
        expect(notJson).toMatchObject({ status: 'BadRequest', data: null, error: { code: -1 } })
        expect(notJson.error.message).toContain('missing string "type"')
        expect(afterwards).toMatchObject({ type: 'GetAllWafersReply', status: 'Success', data: { items: [], totalCount: 0 } })
    })

    it('writes through Kafka: a wafer type created by message is listed by the next message', async () => {
        const create = { name: 'Kafka', engineeringRun: 'ER1', foundry: 'TowerSemiconductor', technology: 'TPSCo65', waferMap: SMALL_MAP }

        const created = await request(JSON.stringify({ type: 'CreateWaferType', data: { create } }))
        const listed = await request(JSON.stringify({ type: 'GetAllWaferTypes' }))

        expect(created).toMatchObject({ status: 'Success', data: { entity: { id: 1, name: 'Kafka' } } })
        expect(listed).toMatchObject({ status: 'Success', data: { totalCount: 1 } })
    })

    it('produces a heartbeat record every two seconds: a string timestamp in epoch seconds with six decimals', async () => {
        const consumer = kafka.consumer({ groupId: `svt-db-agent-next-e2e-hb-${randomUUID()}`, sessionTimeout: 6000 })
        await consumer.connect()
        await consumer.subscribe({ topic: SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC, fromBeginning: false })
        try {
            const beat = await new Promise<Record<string, unknown>>((resolve, reject) => {
                const timer = setTimeout(() => reject(new Error('No heartbeat within 10 s')), 10_000)
                void consumer.run({
                    eachMessage: ({ message }) => {
                        clearTimeout(timer)
                        resolve(JSON.parse(message.value?.toString() ?? '{}') as Record<string, unknown>)
                        return Promise.resolve()
                    },
                })
            })

            expect(Object.keys(beat)).toEqual(['timestamp'])
            expect(beat['timestamp']).toMatch(/^\d{10}\.\d{6}$/)
            expect(Math.abs(Number(beat['timestamp']) - Date.now() / 1000)).toBeLessThan(10)
        }
        finally {
            await consumer.disconnect()
        }
    }, 30_000)

})
