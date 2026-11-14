// @vitest-environment node
import { ConfigService } from '@nestjs/config'

import { SvtDbAgentNextConfig } from '../../config'

import { SvtDbAgentNextKafkaBacklogService } from './svt-db-agent-next-kafka-backlog.service'


const admin = vi.hoisted(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTopics: vi.fn(),
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

describe('SvtDbAgentNextKafkaBacklogService', () => {

    const config = { get: () => ({ brokers: ['kafka:9094'] }) } as unknown as ConfigService<SvtDbAgentNextConfig, true>
    const service = new SvtDbAgentNextKafkaBacklogService(config)

    beforeEach(() => {
        vi.clearAllMocks()
        admin.listTopics.mockResolvedValue([REQUEST_TOPIC])
        admin.fetchTopicOffsets.mockResolvedValue([{ partition: 0, offset: '120', high: '120', low: '0' }])
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

    it('does nothing on a broker without the request topic', async () => {
        admin.listTopics.mockResolvedValue(['svt.db-agent.heartbeat'])

        expect(await service.skip()).toEqual({ kept: 'no-topic' })
        expect(admin.fetchOffsets).not.toHaveBeenCalled()
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
