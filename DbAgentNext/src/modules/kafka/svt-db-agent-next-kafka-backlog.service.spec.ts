// @vitest-environment node
import { ConfigService } from '@nestjs/config'

import { SvtDbAgentNextConfig } from '../../config'

import { SvtDbAgentNextKafkaBacklogService } from './svt-db-agent-next-kafka-backlog.service'


const admin = vi.hoisted(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTopics: vi.fn(),
    createTopics: vi.fn(),
    fetchOffsets: vi.fn(),
    fetchTopicOffsets: vi.fn(),
    setOffsets: vi.fn(),
}))

vi.mock('kafkajs', async (importOriginal) => ({
    ...(await importOriginal<typeof import('kafkajs')>()),
    Kafka: class {

        admin(): typeof admin {
            return admin
        }

    },
}))

const REQUEST_TOPIC = 'svt.db-agent.request'
const GROUP = 'svt.db-agent.request'

/**
 * What a brand-new broker answers to a group request until `__consumer_offsets` is ready: a `KafkaJSProtocolError`
 * (kafkajs spreads its error classes into `module.exports`, so an ESM import does not see them).
 */
const notCoordinator = (): Error => Object.assign(
    new Error('This is not the correct coordinator for this group'),
    { name: 'KafkaJSProtocolError', type: 'NOT_COORDINATOR_FOR_GROUP', code: 16, retriable: true },
)

describe('SvtDbAgentNextKafkaBacklogService', () => {

    const config = { get: () => ({ brokers: ['kafka:9094'] }) } as unknown as ConfigService<SvtDbAgentNextConfig, true>
    const service = new SvtDbAgentNextKafkaBacklogService(config)

    beforeEach(() => {
        vi.clearAllMocks()
        admin.listTopics.mockResolvedValue([REQUEST_TOPIC])
        admin.fetchTopicOffsets.mockResolvedValue([{ partition: 0, offset: '120', high: '120', low: '0' }])
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('moves the group to the end of the request topic and reports how many requests it skipped', async () => {
        admin.fetchOffsets.mockResolvedValue([{ topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '100' }] }])

        expect(await service.skip()).toEqual({ skipped: 20 })
        expect(admin.fetchOffsets).toHaveBeenCalledWith({ groupId: GROUP, topics: [REQUEST_TOPIC] })
        expect(admin.setOffsets).toHaveBeenCalledWith({
            groupId: GROUP, topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '120' }],
        })
        expect(admin.disconnect).toHaveBeenCalled()
    })

    it('leaves a group that is already at the end alone', async () => {
        admin.fetchOffsets.mockResolvedValue([{ topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '120' }] }])

        expect(await service.skip()).toEqual({ skipped: 0 })
        expect(admin.setOffsets).not.toHaveBeenCalled()
    })

    it('leaves a group without a committed offset alone: fromBeginning false starts it at the end', async () => {
        admin.fetchOffsets.mockResolvedValue([{ topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '-1' }] }])

        expect(await service.skip()).toEqual({ kept: 'no-committed-offset' })
        expect(admin.setOffsets).not.toHaveBeenCalled()
    })

    it('creates the request topic on a broker without it', async () => {
        admin.listTopics.mockResolvedValue(['svt.db-agent.heartbeat'])
        admin.fetchOffsets.mockResolvedValue([{ topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '-1' }] }])

        expect(await service.skip()).toEqual({ kept: 'no-committed-offset' })
        expect(admin.createTopics).toHaveBeenCalledWith({
            waitForLeaders: true,
            topics: [{ topic: REQUEST_TOPIC, numPartitions: 1, replicationFactor: 1 }],
        })
    })

    it('does not create a request topic that exists', async () => {
        admin.fetchOffsets.mockResolvedValue([{ topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '120' }] }])

        await service.skip()
        expect(admin.createTopics).not.toHaveBeenCalled()
    })

    it('waits for the group coordinator of a brand-new broker', async () => {
        vi.useFakeTimers()
        admin.fetchOffsets
            .mockRejectedValueOnce(notCoordinator())
            .mockResolvedValue([{ topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '100' }] }])

        const result = service.skip()
        await vi.advanceTimersByTimeAsync(500)

        expect(await result).toEqual({ skipped: 20 })
        expect(admin.fetchOffsets).toHaveBeenCalledTimes(2)
    })

    it('gives up when the group coordinator does not answer within 30 s', async () => {
        vi.useFakeTimers()
        admin.fetchOffsets.mockRejectedValue(notCoordinator())

        const result = expect(service.skip()).rejects.toThrow('This is not the correct coordinator for this group')
        await vi.advanceTimersByTimeAsync(31_000)

        await result
        expect(admin.disconnect).toHaveBeenCalled()
    })

    it('does not retry an error that is not retriable', async () => {
        admin.fetchOffsets.mockRejectedValue(new Error('Group authorization failed'))

        await expect(service.skip()).rejects.toThrow('Group authorization failed')
        expect(admin.fetchOffsets).toHaveBeenCalledTimes(1)
    })

    it('keeps the offsets when another member holds the group (the broker rejects the reset)', async () => {
        admin.fetchOffsets.mockResolvedValue([{ topic: REQUEST_TOPIC, partitions: [{ partition: 0, offset: '100' }] }])
        admin.setOffsets.mockRejectedValue(new Error('The consumer group must have no running instances, current state: Stable'))

        expect(await service.skip()).toEqual({
            kept: 'group-active',
            reason: 'The consumer group must have no running instances, current state: Stable',
        })
        expect(admin.disconnect).toHaveBeenCalled()
    })

})
