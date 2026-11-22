import { Logger } from '@nestjs/common'
import { Kafka, logLevel } from 'kafkajs'
import { SvtDbAgentKafka } from 'svt-ts-types/kafka'


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
