import { TestSetup } from '../utils'


/**
 * Every route of the BFF, and the spec that covers it. A new endpoint fails this spec until it is added here, with
 * its spec in `test-e2e/<domain>/` (README → "Writing a spec for a new endpoint").
 */
const COVERED: Record<string, string> = {
    'GET /api/asics': 'asics',
    'GET /api/asics/:asicId': 'asics',
    'POST /api/asics': 'asics',
    'GET /api/auth/me': 'auth',
    'POST /api/auth/login': 'auth',
    'POST /api/auth/logout': 'auth',
    'GET /api/chip-blocks': 'chip-blocks',
    'GET /api/chip-blocks/:chipBlockId': 'chip-blocks',
    'GET /api/chips': 'chips',
    'GET /api/chips/:chipId': 'chips',
    'POST /api/chips': 'chips',
    'POST /api/chips/create-many': 'chips',
    'POST /api/chips/:chipId/location': 'chips',
    'GET /api/chips/:chipId/location-history': 'chips',
    'GET /api/enums': 'enums',
    'GET /api/equipment-types': 'equipment',
    'POST /api/equipment-types': 'equipment',
    'GET /api/equipment': 'equipment',
    'POST /api/equipment': 'equipment',
    'POST /api/equipment/:equipmentId/location': 'equipment',
    'GET /api/equipment/:equipmentId/location-history': 'equipment',
    'GET /api/health': 'health',
    'GET /api/health/version': 'health',
    'GET /api/svt-test-setup-configs': 'svt-test-catalog',
    'GET /api/svt-test-setup-configs/:id': 'svt-test-catalog',
    'GET /api/svt-test-setup-configs/:id/config-body': 'svt-test-catalog',
    'POST /api/svt-test-setup-configs': 'svt-test-catalog',
    'GET /api/svt-test-setups': 'svt-test-catalog',
    'GET /api/svt-test-setups/:id': 'svt-test-catalog',
    'POST /api/svt-test-setups': 'svt-test-catalog',
    'PATCH /api/svt-test-setups/:id': 'svt-test-catalog',
    'GET /api/svt-test-templates': 'svt-test-catalog',
    'GET /api/svt-test-templates/:id': 'svt-test-catalog',
    'POST /api/svt-test-templates': 'svt-test-catalog',
    'PATCH /api/svt-test-templates/:id': 'svt-test-catalog',
    'GET /api/svt-test-type-configs': 'svt-test-catalog',
    'GET /api/svt-test-type-configs/:id': 'svt-test-catalog',
    'GET /api/svt-test-type-configs/:id/config-body': 'svt-test-catalog',
    'POST /api/svt-test-type-configs': 'svt-test-catalog',
    'GET /api/svt-test-types': 'svt-test-catalog',
    'GET /api/svt-test-types/:id': 'svt-test-catalog',
    'POST /api/svt-test-types': 'svt-test-catalog',
    'PATCH /api/svt-test-types/:id': 'svt-test-catalog',
    'GET /api/svt-tests': 'svt-tests',
    'GET /api/svt-tests/:id': 'svt-tests',
    'POST /api/svt-tests': 'svt-tests',
    'GET /api/wafer-types': 'wafers',
    'POST /api/wafer-types': 'wafers',
    'GET /api/wafer-types/:waferTypeId/wafer-map': 'wafers',
    'GET /api/wafers': 'wafers',
    'GET /api/wafers/:waferId': 'wafers',
    'POST /api/wafers': 'wafers',
    'PATCH /api/wafers/:waferId': 'wafers',
    'POST /api/wafers/:waferId/location': 'wafers',
    'GET /api/wafers/:waferId/location-history': 'wafers',
    'GET /api/wp-machines': 'wp',
    'GET /api/wp-machines/:id': 'wp',
    'POST /api/wp-machines': 'wp',
    'PATCH /api/wp-machines/:id': 'wp',
    'POST /api/wp-machines/:id/loaded-wafer': 'wp',
    'POST /api/wp-machines/:id/installed-probe-card': 'wp',
    'GET /api/wp-probe-cards': 'wp',
    'GET /api/wp-probe-cards/:id': 'wp',
    'GET /api/wp-projects': 'wp',
    'GET /api/wp-projects/:id': 'wp',
    'POST /api/wp-projects': 'wp',
}

/** Routes that do not go through the DB agent, out of this suite's scope: they talk TCP to an instrument. */
const NOT_COVERED = ['POST /api/tcp/read', 'POST /api/tcp/send', 'POST /api/tcp/send-and-read']

describe('Routes (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    it('has an e2e spec for every route of the BFF that goes through the DB agent', () => {
        expect(setup.routes()).toEqual([...Object.keys(COVERED), ...NOT_COVERED].sort())
    })

})
