import { KafkaOptions, Transport } from '@nestjs/microservices'
import { CompressionTypes } from 'kafkajs'


/** `client.id` of the consumer and the reply producer; the heartbeat producer appends `-heartbeat`. */
export const SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID = 'svt-db-agent-next'

/**
 * The consumer group of the C++ agent (`DbAgent/docs/01-architecture.md` §4), kept so that a deployment
 * swap is a plain consumer handover: the broker gives the partition to whichever agent is up.
 */
export const SVT_DB_AGENT_NEXT_KAFKA_CONSUMER_GROUP = 'svt.db-agent.request'

/** The heartbeat topic and its retention, as the C++ agent created them (`01-architecture.md` §4, §8). */
export const SVT_DB_AGENT_NEXT_HEARTBEAT_TOPIC = 'svt.db-agent.heartbeat'
export const SVT_DB_AGENT_NEXT_HEARTBEAT_INTERVAL_MS = 2000
export const SVT_DB_AGENT_NEXT_HEARTBEAT_RETENTION_MS = 60_000
export const SVT_DB_AGENT_NEXT_HEARTBEAT_SEGMENT_MS = 120_000

/** The heartbeat record: seconds since the epoch with six decimals, as a **string** (the healthcheck contract). */
export type SvtDbAgentNextHeartbeat = {
    timestamp: string
}

/**
 * The Kafka microservice options (`Transport.KAFKA`), as the mock agent and the BFF configure theirs:
 * Kafka's 1 MB defaults are too small for list replies, so the consumer accepts 10 MiB per partition and
 * 50 MiB per fetch (the brokers are configured for 50 MiB) and replies are gzip-compressed.
 *
 * `postfixId: ''`: NestJS appends its postfix (`-server` by default) to `clientId` and `groupId`; without this the
 * group would be `svt.db-agent.request-server`, not the C++ agent's. `fromBeginning: false` covers a group
 * without a committed offset only; the requests produced while the agent was down are skipped by
 * `SvtDbAgentNextKafkaBacklogService` before the consumer starts.
 */
export function buildSvtDbAgentNextKafkaOptions(brokers: string[]): KafkaOptions {
    return {
        transport: Transport.KAFKA,
        options: {
            postfixId: '',
            client: {
                clientId: SVT_DB_AGENT_NEXT_KAFKA_CLIENT_ID,
                brokers,
            },
            consumer: {
                groupId: SVT_DB_AGENT_NEXT_KAFKA_CONSUMER_GROUP,
                maxBytesPerPartition: 10 * 1024 * 1024,
                maxBytes: 50 * 1024 * 1024,
            },
            send: {
                compression: CompressionTypes.GZIP,
            },
            subscribe: {
                fromBeginning: false,
            },
        },
    }
}

/** `{ timestamp: '<seconds>.<6 decimals>' }` for a moment given in milliseconds since the epoch. */
export function buildSvtDbAgentNextHeartbeat(nowMs = Date.now()): SvtDbAgentNextHeartbeat {
    const seconds = Math.floor(nowMs / 1000)
    const micros = (nowMs - seconds * 1000) * 1000
    return { timestamp: `${seconds}.${String(micros).padStart(6, '0')}` }
}
