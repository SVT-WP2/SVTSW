import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Admin, Kafka, logLevel } from 'kafkajs'
import { SvtDbAgentKafka } from 'svt-ts-types/kafka'

import { SvtDbAgentNextConfig } from '../../config'

import { SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID, SVT_DB_AGENT_NEXT_KAFKA_CONSUMER_GROUP } from './svt-db-agent-next-kafka.models'


/** What `skip()` did: how many requests it skipped, or why it left the offsets as they were. */
export type SvtDbAgentNextKafkaBacklogResult =
    | { skipped: number }
    | {
        kept: 'no-topic' | 'no-committed-offset' | 'group-active'
        reason?: string
    }

/**
 * Skips the requests produced while no agent consumed `svt.db-agent.request`, as the C++ agent does: it seeks
 * to the end at start (`DbAgent/docs/01-architecture.md` §4). Their clients gave up long ago, and a write among
 * them would change the database now. kafkajs resumes from the group's committed offset and honours
 * `fromBeginning: false` only for a group without one, so the bootstrap calls `skip()` before the consumer
 * starts: it moves the group's offsets on the request topic to the end.
 *
 * The broker accepts that only while the group has no member. With another agent in it (a handover from a
 * running agent, or a restarted one the broker still counts until its session times out) the offsets stay
 * and the consumer joins the group as it is.
 */
@Injectable()
export class SvtDbAgentNextKafkaBacklogService {

    private readonly logger = new Logger(SvtDbAgentNextKafkaBacklogService.name)

    constructor(private readonly configService: ConfigService<SvtDbAgentNextConfig, true>) {
    }

    async skip(): Promise<SvtDbAgentNextKafkaBacklogResult> {
        const { brokers } = this.configService.get('kafka', { infer: true })
        const kafka = new Kafka({ clientId: `${SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID}-admin`, brokers, logLevel: logLevel.NOTHING })
        const admin = kafka.admin()
        await admin.connect()
        try {
            const result = await this.moveToEnd(admin)
            this.report(result)
            return result
        }
        finally {
            await admin.disconnect()
        }
    }

    private async moveToEnd(admin: Admin): Promise<SvtDbAgentNextKafkaBacklogResult> {
        const topic = SvtDbAgentKafka.TopicName.Request
        if (!(await admin.listTopics()).includes(topic)) {
            return { kept: 'no-topic' }
        }
        const groupId = SVT_DB_AGENT_NEXT_KAFKA_CONSUMER_GROUP
        const [committed] = await admin.fetchOffsets({ groupId, topics: [topic] })
        const ends = await admin.fetchTopicOffsets(topic)
        let skipped = 0
        let anyCommitted = false
        for (const end of ends) {
            const offset = Number(committed?.partitions.find((partition) => partition.partition === end.partition)?.offset ?? -1)
            if (offset >= 0) {
                anyCommitted = true
                skipped += Math.max(0, Number(end.offset) - offset)
            }
        }
        if (!anyCommitted) {
            // `fromBeginning: false` starts such a group at the end already.
            return { kept: 'no-committed-offset' }
        }
        if (skipped === 0) {
            return { skipped }
        }
        try {
            await admin.setOffsets({
                groupId,
                topic,
                partitions: ends.map((end) => ({ partition: end.partition, offset: end.offset })),
            })
        }
        catch (error) {
            return { kept: 'group-active', reason: error instanceof Error ? error.message : String(error) }
        }
        return { skipped }
    }

    private report(result: SvtDbAgentNextKafkaBacklogResult): void {
        const group = SVT_DB_AGENT_NEXT_KAFKA_CONSUMER_GROUP
        if ('skipped' in result) {
            if (result.skipped > 0) {
                this.logger.warn(`Skipped ${result.skipped} request(s) produced while no agent consumed group ${group}`)
            }
        }
        else if (result.kept === 'group-active') {
            this.logger.warn(`Group ${group} has another member; joining it at its committed offset (${result.reason})`)
        }
    }

}
