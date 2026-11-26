import { randomUUID } from 'node:crypto'

import { Admin, Kafka, logLevel } from 'kafkajs'
import { SvtDbAgentKafka } from 'svt-ts-types/kafka'


/** The DB agent's consumer group: fixed by design (the C++ agent's), see `DbAgentNext/CLAUDE.md`. */
export const SVT_DB_AGENT_CONSUMER_GROUP = 'svt.db-agent.request'

/** The BFF's reply consumers: `epic-ui.<module>` plus NestJS's `-client` postfix. */
export const EPIC_API_REPLY_GROUP_PREFIX = 'epic-ui.'

/** How long the harness waits for the members of a crashed run to time out (kafkajs' session timeout is 30 s). */
const IDLE_GROUPS_TIMEOUT_MS = 45_000

/**
 * Readies the dedicated e2e broker for a run: the request and reply topics exist (one partition each, as on dev),
 * and neither the agent's group nor a BFF reply group has a member. A member there is another agent or BFF on the
 * e2e broker, which would take the suite's requests or replies, or the leftover of a crashed run, which the broker
 * drops after its session timeout; the harness waits for that, then gives up.
 */
export async function prepareE2eBroker(broker: string): Promise<void> {
    const kafka = new Kafka({ clientId: 'epic-measure-api-e2e', brokers: [broker], logLevel: logLevel.NOTHING })
    const admin = kafka.admin()
    try {
        await admin.connect()
    }
    catch (error) {
        throw new Error(
            `No Kafka broker at ${broker} (${error instanceof Error ? error.message : String(error)}). Start the e2e broker `
            + 'from the repository root: docker compose -f Dev/docker-compose.e2e.yml up -d',
        )
    }
    try {
        await admin.createTopics({
            waitForLeaders: true,
            topics: [SvtDbAgentKafka.TopicName.Request, SvtDbAgentKafka.TopicName.RequestReply]
                .map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
        })
        await waitForGroupCoordinator(admin)
        await waitForIdleGroups(admin, broker)
    }
    finally {
        await admin.disconnect()
    }
}

/**
 * A brand-new broker creates `__consumer_offsets` on the first group request and answers "not the correct
 * coordinator" until it is ready. The agent's backlog skip waits for it too (E2E-10); the harness asks first because
 * its own group checks below need the coordinator.
 */
async function waitForGroupCoordinator(admin: Admin): Promise<void> {
    const deadline = Date.now() + IDLE_GROUPS_TIMEOUT_MS
    for (;;) {
        try {
            await admin.fetchOffsets({ groupId: SVT_DB_AGENT_CONSUMER_GROUP, topics: [SvtDbAgentKafka.TopicName.Request] })
            return
        }
        catch (error) {
            if (Date.now() > deadline) {
                throw error
            }
            await new Promise((resolve) => setTimeout(resolve, 500))
        }
    }
}

async function waitForIdleGroups(admin: Admin, broker: string): Promise<void> {
    const deadline = Date.now() + IDLE_GROUPS_TIMEOUT_MS
    for (;;) {
        const { groups } = await admin.listGroups()
        const groupIds = groups
            .map((group) => group.groupId)
            .filter((groupId) => groupId === SVT_DB_AGENT_CONSUMER_GROUP || groupId.startsWith(EPIC_API_REPLY_GROUP_PREFIX))
        const busy = groupIds.length
            ? (await admin.describeGroups(groupIds)).groups.filter((group) => group.members.length > 0)
            : []
        if (!busy.length) {
            return
        }
        if (Date.now() > deadline) {
            const members = busy.map((group) => `${group.groupId} (${group.members.map((member) => member.clientHost).join(', ')})`)
            throw new Error(
                `Consumer group(s) ${members.join('; ')} still have members on ${broker}: another DB agent or BFF uses the `
                + 'e2e broker. Stop it and run the suite again.',
            )
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
}

/** A record of the request topic as the DB agent receives it: the headers as text, and the parsed value. */
export type E2eRequestRecord = {
    offset: string
    headers: Record<string, string | undefined>
    value: { type: string; data?: any }
}

/**
 * Reads the records of `svt.db-agent.request` that arrive after `mark()`, with their headers: what the BFF really
 * sends to the DB agent. A consumer of its own group (not one of the groups the global setup checks), which it
 * deletes after the read.
 *
 * ```ts
 * const reader = new E2eRequestTopicReader(config.kafkaBroker)
 * await reader.mark()
 * await setup.get('/api/wafer-types')
 * const records = await reader.read((all) => all.some((record) => record.value.type === 'GetAllWaferTypes'))
 * ```
 */
export class E2eRequestTopicReader {

    private readonly kafka: Kafka
    private marks: { partition: number; offset: string }[] = []

    constructor(broker: string) {
        this.kafka = new Kafka({ clientId: 'epic-measure-api-e2e.reader', brokers: [broker], logLevel: logLevel.NOTHING })
    }

    /** Remembers the end of each partition: `read` returns what comes after it. */
    async mark(): Promise<void> {
        const admin = this.kafka.admin()
        await admin.connect()
        try {
            const offsets = await admin.fetchTopicOffsets(SvtDbAgentKafka.TopicName.Request)
            this.marks = offsets.map(({ partition, high }) => ({ partition, offset: high }))
        }
        finally {
            await admin.disconnect()
        }
    }

    /** The records after the mark, once `until` is true for them; fails after `timeoutMs`. */
    async read(until: (records: E2eRequestRecord[]) => boolean, timeoutMs = 20_000): Promise<E2eRequestRecord[]> {
        const groupId = `epic-measure-api-e2e.reader.${randomUUID()}`
        const consumer = this.kafka.consumer({ groupId })
        const records: E2eRequestRecord[] = []
        const start = new Map(this.marks.map(({ partition, offset }) => [partition, BigInt(offset)]))
        try {
            await consumer.connect()
            await consumer.subscribe({ topic: SvtDbAgentKafka.TopicName.Request, fromBeginning: false })
            await consumer.run({
                eachMessage: ({ partition, message }) => {
                    if (BigInt(message.offset) < (start.get(partition) ?? 0n)) {
                        return Promise.resolve()
                    }
                    const headers = Object.fromEntries(Object.entries(message.headers ?? {})
                        .map(([key, value]) => [key, value === undefined ? undefined : String(value)]))
                    records.push({ offset: message.offset, headers, value: JSON.parse(String(message.value)) })
                    return Promise.resolve()
                },
            })
            for (const { partition, offset } of this.marks) {
                consumer.seek({ topic: SvtDbAgentKafka.TopicName.Request, partition, offset })
            }
            const deadline = Date.now() + timeoutMs
            while (!until(records)) {
                if (Date.now() > deadline) {
                    throw new Error(`The request topic did not get the expected records within ${timeoutMs} ms: ${JSON.stringify(records)}`)
                }
                await new Promise((resolve) => setTimeout(resolve, 100))
            }
            return records
        }
        finally {
            await consumer.disconnect()
            const admin = this.kafka.admin()
            await admin.connect()
            await admin.deleteGroups([groupId]).catch(() => undefined)
            await admin.disconnect()
        }
    }

}
