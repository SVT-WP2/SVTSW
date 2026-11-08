import { Injectable, Logger, OnApplicationShutdown } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Kafka, logLevel, Producer } from 'kafkajs'

import { SvtDbAgentNextConfig } from '../../config'

import {
    buildSvtDbAgentNextHeartbeat,
    SVT_DB_AGENT_NEXT_HEARTBEAT_INTERVAL_MS,
    SVT_DB_AGENT_NEXT_HEARTBEAT_RETENTION_MS,
    SVT_DB_AGENT_NEXT_HEARTBEAT_SEGMENT_MS,
    SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC,
    SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID,
} from './svt-db-agent-next-kafka.models'


/**
 * The heartbeat of the C++ agent (`DbAgent/docs/01-architecture.md` §8): `{ "timestamp": "<seconds>.<6
 * decimals>" }` to `svt.db-agent.heartbeat` every 2 s, no key, no headers. The topic is created with the
 * short retention the C++ gave it when the broker has not got it yet.
 *
 * `start()` is called by the bootstrap once the Kafka microservice is connected, never by the e2e harness,
 * which boots the same module without a broker. A failed beat is logged and the next one tried.
 */
@Injectable()
export class SvtDbAgentNextHeartbeatService implements OnApplicationShutdown {

    private readonly logger = new Logger(SvtDbAgentNextHeartbeatService.name)
    private producer?: Producer
    private timer?: NodeJS.Timeout

    constructor(private readonly configService: ConfigService<SvtDbAgentNextConfig, true>) {
    }

    async start(): Promise<void> {
        const { brokers } = this.configService.get('kafka', { infer: true })
        const kafka = new Kafka({ clientId: `${SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID}-heartbeat`, brokers, logLevel: logLevel.ERROR })
        await this.ensureTopic(kafka)
        this.producer = kafka.producer()
        await this.producer.connect()
        this.timer = setInterval(() => void this.beat(), SVT_DB_AGENT_NEXT_HEARTBEAT_INTERVAL_MS)
        this.logger.log(`Heartbeat every ${SVT_DB_AGENT_NEXT_HEARTBEAT_INTERVAL_MS} ms on ${SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC}`)
    }

    async onApplicationShutdown(): Promise<void> {
        if (this.timer) {
            clearInterval(this.timer)
            this.timer = undefined
        }
        await this.producer?.disconnect()
        this.producer = undefined
    }

    private async beat(): Promise<void> {
        try {
            await this.producer?.send({
                topic: SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC,
                messages: [{ value: JSON.stringify(buildSvtDbAgentNextHeartbeat()) }],
            })
        }
        catch (error) {
            this.logger.warn(`Heartbeat not sent: ${error instanceof Error ? error.message : String(error)}`)
        }
    }

    /**
     * Creates the heartbeat topic with the C++ agent's retention when the broker has not got it. Checked first:
     * kafkajs logs an error for a `CreateTopics` on an existing topic even though it reports it as not created.
     */
    private async ensureTopic(kafka: Kafka): Promise<void> {
        const admin = kafka.admin()
        await admin.connect()
        try {
            if ((await admin.listTopics()).includes(SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC)) {
                return
            }
            const created = await admin.createTopics({
                waitForLeaders: true,
                topics: [{
                    topic: SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC,
                    numPartitions: 1,
                    replicationFactor: 1,
                    configEntries: [
                        { name: 'retention.ms', value: String(SVT_DB_AGENT_NEXT_HEARTBEAT_RETENTION_MS) },
                        { name: 'segment.ms', value: String(SVT_DB_AGENT_NEXT_HEARTBEAT_SEGMENT_MS) },
                    ],
                }],
            })
            if (created) {
                this.logger.log(`Created topic ${SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC}`)
            }
        }
        finally {
            await admin.disconnect()
        }
    }

}
