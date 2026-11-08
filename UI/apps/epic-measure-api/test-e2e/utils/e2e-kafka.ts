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
 * coordinator" until it is ready. The agent's backlog skip at start does not retry that (it exits), so the harness
 * asks first, until the coordinator answers.
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
