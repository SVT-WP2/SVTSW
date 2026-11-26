// @vitest-environment node
import { INestApplication } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'

import { EpicRequestContext } from '../common'

import { connectEpicMeasureApiKafkaClients, ensureEpicMeasureApiKafkaTopics } from './epic-measure-api-kafka.setup'


const admin = vi.hoisted(() => ({
    connect: vi.fn(),
    disconnect: vi.fn(),
    listTopics: vi.fn(),
    createTopics: vi.fn(),
}))

vi.mock('kafkajs', async (importOriginal) => ({
    ...(await importOriginal<typeof import('kafkajs')>()),
    Kafka: class {

        admin(): typeof admin {
            return admin
        }

    },
}))

describe('ensureEpicMeasureApiKafkaTopics', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('creates the consumed topics that the broker has not got', async () => {
        admin.listTopics.mockResolvedValue(['svt.db-agent.request'])

        await ensureEpicMeasureApiKafkaTopics(['kafka:9094'])

        expect(admin.createTopics).toHaveBeenCalledWith({
            waitForLeaders: true,
            topics: [{ topic: 'svt.db-agent.request.reply', numPartitions: 1, replicationFactor: 1 }],
        })
        expect(admin.disconnect).toHaveBeenCalled()
    })

    it('creates nothing when the broker has every consumed topic', async () => {
        admin.listTopics.mockResolvedValue(['svt.db-agent.request', 'svt.db-agent.request.reply'])

        await ensureEpicMeasureApiKafkaTopics(['kafka:9094'])

        expect(admin.createTopics).not.toHaveBeenCalled()
        expect(admin.disconnect).toHaveBeenCalled()
    })

})

describe('connectEpicMeasureApiKafkaClients', () => {

    function fakeClient(assigned: boolean, seen: string[]): ClientKafka {
        return Object.assign(Object.create(ClientKafka.prototype) as ClientKafka, {
            connect: vi.fn(() => {
                seen.push(EpicRequestContext.capture() ? 'in a request context' : 'outside')
                return Promise.resolve()
            }),
            getConsumerAssignments: () => (assigned ? { 'svt.db-agent.request.reply': 0 } : {}),
        })
    }

    function fakeApp(...instances: unknown[]): INestApplication {
        return { get: () => ({ getProviders: () => instances.map((instance) => ({ instance })) }) } as unknown as INestApplication
    }

    it('connects every Kafka client outside any request context, also when it is called inside one', async () => {
        const seen: string[] = []
        const clients = [fakeClient(true, seen), fakeClient(true, seen)]

        const result = await EpicRequestContext.run(() => {
            EpicRequestContext.setUserId(1)
            return connectEpicMeasureApiKafkaClients(fakeApp(...clients, { notAClient: true }), 100)
        })

        expect(seen).toEqual(['outside', 'outside'])
        expect(result).toEqual({ clients, unassigned: 0 })
    })

    it('reports the clients that got no partition of the reply topic within the time', async () => {
        const seen: string[] = []

        const result = await connectEpicMeasureApiKafkaClients(fakeApp(fakeClient(true, seen), fakeClient(false, seen)), 100)

        expect(result.unassigned).toBe(1)
    })

})
