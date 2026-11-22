// @vitest-environment node
import { ensureEpicMeasureApiKafkaTopics } from './epic-measure-api-kafka.setup'


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
