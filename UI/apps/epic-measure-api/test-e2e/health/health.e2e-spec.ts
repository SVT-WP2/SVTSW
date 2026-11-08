import { TestSetup } from '../utils'


describe('Health (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    describe('GET /api/health', () => {

        it('answers up without touching Kafka', async () => {
            const response = await setup.get('/api/health')

            expect(response).toEqual({
                status: 200,
                body: { status: 'ok', info: { api: { status: 'up' } }, error: {}, details: { api: { status: 'up' } } },
            })
        })

    })

    describe('GET /api/health/version', () => {

        it('names the service, its package version and its uptime', async () => {
            const response = await setup.get('/api/health/version')

            expect(response.status).toBe(200)
            expect(response.body).toEqual({ service: 'epic-measure-api', version: '0.0.1', uptime: expect.stringMatching(/^\d+s$/) })
        })

    })

})
