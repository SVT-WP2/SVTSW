import { INestApplication, Logger } from '@nestjs/common'
import { DiscoveryService } from '@nestjs/core'
import { ClientKafka } from '@nestjs/microservices'
import { Kafka, logLevel } from 'kafkajs'
import { SvtDbAgentKafka } from 'svt-ts-types/kafka'

import { EpicRequestContext } from '../common'


/**
 * Creates the topics that the BFF consumes when the broker has not got them: the reply topic of every
 * `ClientKafka`, and both topics of the logging `@EventPattern`s in `EpicWafersController`. Without this step, a
 * brand-new KRaft broker answers the consumer's first metadata request "This server does not host this
 * topic-partition" while it auto-creates the topic; kafkajs does not retry that, and the boot ends. Call it
 * before `app.startAllMicroservices()`.
 */
export async function ensureEpicMeasureApiKafkaTopics(brokers: string[]): Promise<void> {
    const kafka = new Kafka({ clientId: 'epic-ui-admin', brokers, logLevel: logLevel.NOTHING })
    const admin = kafka.admin()
    await admin.connect()
    try {
        const existing = await admin.listTopics()
        const missing = [SvtDbAgentKafka.TopicName.Request, SvtDbAgentKafka.TopicName.RequestReply]
            .filter((topic) => !existing.includes(topic))
        if (!missing.length) {
            return
        }
        const created = await admin.createTopics({
            waitForLeaders: true,
            topics: missing.map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
        })
        if (created) {
            Logger.log(`Created topic(s) ${missing.join(', ')}`, 'EpicMeasureApiKafka')
        }
    }
    finally {
        await admin.disconnect()
    }
}

/** The clients that `connectEpicMeasureApiKafkaClients` connected, and how many of them still wait for their reply partition. */
export type EpicMeasureApiKafkaClients = {
    clients: ClientKafka[]
    unassigned: number
}

/**
 * Connects every `ClientKafka` of the application (one per module) at boot, outside any request context, and waits
 * up to `assignmentTimeoutMs` until each consumer holds its partition of the reply topic. Call it after `app.init()`
 * (the services subscribe to their reply topic in `onModuleInit`).
 *
 * A client that connected at its first request would run its consumer, and so the handling of every later reply, in
 * the request context of that first request (`sendEpicDbAgentRequest` delivers each reply in the context of its own
 * request anyway). A request from a client without its reply partition fails (`InvalidKafkaClientTopicException`).
 */
export async function connectEpicMeasureApiKafkaClients(
    app: INestApplication,
    assignmentTimeoutMs = 30_000,
): Promise<EpicMeasureApiKafkaClients> {
    const clients = app.get(DiscoveryService).getProviders()
        .map((wrapper) => wrapper.instance as unknown)
        .filter((instance): instance is ClientKafka => instance instanceof ClientKafka)
    await EpicRequestContext.outside(() => Promise.all(clients.map((client) => client.connect())))

    const deadline = Date.now() + assignmentTimeoutMs
    const unassigned = () => clients
        .filter((client) => client.getConsumerAssignments()[SvtDbAgentKafka.TopicName.RequestReply] === undefined).length
    while (unassigned() > 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50))
    }
    return { clients, unassigned: unassigned() }
}
