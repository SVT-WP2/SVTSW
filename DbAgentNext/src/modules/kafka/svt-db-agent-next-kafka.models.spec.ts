// @vitest-environment node
import { Transport } from '@nestjs/microservices'
import { CompressionTypes } from 'kafkajs'

import { buildSvtDbAgentNextHeartbeat, buildSvtDbAgentNextKafkaOptions } from './svt-db-agent-next-kafka.models'


describe('buildSvtDbAgentNextKafkaOptions', () => {

    it('joins the C++ consumer group, lifts the fetch limits, compresses replies and skips old records', () => {
        const options = buildSvtDbAgentNextKafkaOptions(['kafka:9094'])

        expect(options.transport).toBe(Transport.KAFKA)
        expect(options.options).toEqual({
            client: { clientId: 'svt-db-agent-next', brokers: ['kafka:9094'] },
            consumer: { groupId: 'svt.db-agent.request', maxBytesPerPartition: 10 * 1024 * 1024, maxBytes: 50 * 1024 * 1024 },
            send: { compression: CompressionTypes.GZIP },
            subscribe: { fromBeginning: false },
        })
    })

})

describe('buildSvtDbAgentNextHeartbeat', () => {

    it('formats the moment as epoch seconds with six decimals, as a string', () => {
        expect(buildSvtDbAgentNextHeartbeat(1762500000123)).toEqual({ timestamp: '1762500000.123000' })
        expect(buildSvtDbAgentNextHeartbeat(1762500000000)).toEqual({ timestamp: '1762500000.000000' })
        expect(buildSvtDbAgentNextHeartbeat(1762500000007)).toEqual({ timestamp: '1762500000.007000' })
    })

    it('uses the current time by default', () => {
        const before = Math.floor(Date.now() / 1000)
        const { timestamp } = buildSvtDbAgentNextHeartbeat()
        expect(timestamp).toMatch(/^\d+\.\d{6}$/)
        expect(Number(timestamp.split('.')[0])).toBeGreaterThanOrEqual(before)
    })

})
