import {
    EpicEquipment,
    EpicEquipmentCreateRequest,
    EpicEquipmentLocationHistoryRecord,
    EpicEquipmentType,
    EpicUserRole,
} from 'svt-ts-types'

import { E2E_ADMIN, expectError, expectStatus, TestSetup } from '../utils'


const ENCLUSTRA: EpicEquipmentType = { id: 1, name: 'Enclustra Card' }
const SCOPE: EpicEquipmentType = { id: 2, name: 'Oscilloscope' }

const CREATE: EpicEquipmentCreateRequest = {
    name: 'DAQ-0009012C0D0F341D',
    equipmentTypeId: 1,
    generalLocation: 'CERN',
    specification: JSON.stringify({ vendor: 'Enclustra', firmware: '1.2.0', channels: 4 }, null, 2),
}

/** The specification comes back byte for byte as it was sent: the stored text of the `json` column. */
const EQUIPMENT_1: EpicEquipment = { id: 1, ...CREATE }
const EQUIPMENT_2: EpicEquipment = { id: 2, ...CREATE, name: 'DAQ-0009012C0D0F301D', specification: '{}' }

/** The user fields of a history row that the Admin of the suite wrote over HTTP. */
const BY_ADMIN = { userId: E2E_ADMIN.id, userName: E2E_ADMIN.name }

/** The user fields of a history record. */
type RowUser = { userId: number | null; userName: string | null }

describe('Equipment (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    async function createType(name: string): Promise<EpicEquipmentType> {
        return expectStatus(await setup.post<EpicEquipmentType>('/api/equipment-types', { name }), 201)
    }

    async function createEquipment(create: EpicEquipmentCreateRequest): Promise<EpicEquipment> {
        return expectStatus(await setup.post<EpicEquipment>('/api/equipment', create), 201)
    }

    // ── /api/equipment-types ──────────────────────────────────────

    describe('GET /api/equipment-types', () => {

        it('lists the equipment types in id order as a plain array', async () => {
            expect(expectStatus(await setup.get('/api/equipment-types'), 200)).toEqual([])
            await createType(ENCLUSTRA.name)
            await createType(SCOPE.name)

            const types = expectStatus(await setup.get<EpicEquipmentType[]>('/api/equipment-types'), 200)

            expect(types).toEqual([ENCLUSTRA, SCOPE])
            expect(Object.keys(types[0])).toEqual(['id', 'name'])
        })

        it('filters by ids: one, several (repeated, comma-separated, bracketed), none matching', async () => {
            await createType(ENCLUSTRA.name)
            await createType(SCOPE.name)
            await createType('Multimeter')

            expect((await setup.get('/api/equipment-types?ids=2')).body).toEqual([SCOPE])
            expect((await setup.get('/api/equipment-types?ids=1&ids=2')).body).toEqual([ENCLUSTRA, SCOPE])
            expect((await setup.get('/api/equipment-types?ids=1,2')).body).toEqual([ENCLUSTRA, SCOPE])
            expect((await setup.get('/api/equipment-types?ids[]=1&ids[]=2')).body).toEqual([ENCLUSTRA, SCOPE])
            expect((await setup.get('/api/equipment-types?ids=999')).body).toEqual([])
        })

        it('rejects ids that are no integers', async () => {
            expectError(await setup.get('/api/equipment-types?ids=one'), 400, 'each value in ids must be an integer number')
            expectError(await setup.get('/api/equipment-types?ids=1.5'), 400, 'each value in ids must be an integer number')
        })

    })

    describe('POST /api/equipment-types', () => {

        it('creates the equipment type and answers 201 with the entity', async () => {
            const response = await setup.post('/api/equipment-types', { name: ENCLUSTRA.name })

            expect(response).toEqual({ status: 201, body: ENCLUSTRA })
            expect(await setup.query('select id, name from main."EquipmentType"')).toEqual([ENCLUSTRA])
        })

        it('drops body keys the DTO does not declare instead of forwarding them to the agent', async () => {
            const response = await setup.post('/api/equipment-types', { name: ENCLUSTRA.name, colour: 'blue' })

            expect(response).toEqual({ status: 201, body: ENCLUSTRA })
        })

        it('rejects a missing name (BFF) and a duplicate name (agent) with 400, writing nothing', async () => {
            await createType(ENCLUSTRA.name)

            expectError(await setup.post('/api/equipment-types', {}), 400, 'name must be a string')
            expectError(await setup.post('/api/equipment-types', { name: ENCLUSTRA.name }), 400, 'already exists')
            expect(await setup.count('EquipmentType')).toBe(1)
        })

        // Finding E2E-2 (test-e2e/README.md): the global ValidationPipe's `enableImplicitConversion` converts JSON bodies
        // too, so a number is stored as its string ("5"). Flip to `it` once bodies are no longer converted.
        it.fails('rejects a name that is no string', async () => {
            expectError(await setup.post('/api/equipment-types', { name: 5 }), 400, 'name must be a string')
        })

    })

    // ── /api/equipment ────────────────────────────────────────────

    describe('GET /api/equipment', () => {

        beforeEach(() => createType(ENCLUSTRA.name))

        it('lists the equipment in id order with the specification as a JSON string', async () => {
            expect(expectStatus(await setup.get('/api/equipment'), 200)).toEqual([])
            await createEquipment(CREATE)
            await createEquipment({ ...CREATE, name: EQUIPMENT_2.name, specification: '{}' })

            const equipment = expectStatus(await setup.get<EpicEquipment[]>('/api/equipment'), 200)

            expect(equipment).toEqual([EQUIPMENT_1, EQUIPMENT_2])
            expect(Object.keys(equipment[0])).toEqual(['id', 'name', 'equipmentTypeId', 'generalLocation', 'specification'])
        })

        it('filters by ids: one, several (repeated, comma-separated, bracketed), none matching; rejects non-integers', async () => {
            await createEquipment(CREATE)
            await createEquipment({ ...CREATE, name: EQUIPMENT_2.name, specification: '{}' })
            await createEquipment({ ...CREATE, name: 'DAQ-3', specification: '{}' })

            expect((await setup.get('/api/equipment?ids=2')).body).toEqual([EQUIPMENT_2])
            expect((await setup.get('/api/equipment?ids=1&ids=2')).body).toEqual([EQUIPMENT_1, EQUIPMENT_2])
            expect((await setup.get('/api/equipment?ids=1,2')).body).toEqual([EQUIPMENT_1, EQUIPMENT_2])
            expect((await setup.get('/api/equipment?ids[]=1&ids[]=2')).body).toEqual([EQUIPMENT_1, EQUIPMENT_2])
            expect((await setup.get('/api/equipment?ids=999')).body).toEqual([])
            expectError(await setup.get('/api/equipment?ids=one'), 400, 'each value in ids must be an integer number')
        })

    })

    describe('POST /api/equipment', () => {

        beforeEach(() => createType(ENCLUSTRA.name))

        it('creates the equipment with its first location row, the specification stored as JSON', async () => {
            const response = await setup.post('/api/equipment', CREATE)

            expect(response).toEqual({ status: 201, body: EQUIPMENT_1 })
            expect(await setup.query(
                'select name, "equipmentTypeId", "generalLocation", specification::text as specification from main."Equipment"',
            )).toEqual([{ name: CREATE.name, equipmentTypeId: 1, generalLocation: 'CERN', specification: CREATE.specification }])
            expect(await setup.query('select "equipmentId", "generalLocation", note from main."EquipmentLocation"'))
                .toEqual([{ equipmentId: 1, generalLocation: 'CERN', note: 'Location at creation' }])
        })

        it('validates the body: every member required with its type (BFF)', async () => {
            const response = await setup.post('/api/equipment', {})

            expectError(
                response, 400,
                'name must be a string', 'equipmentTypeId must be a number', 'generalLocation must be a string',
                'specification must be a string',
            )
            expectError(
                await setup.post('/api/equipment', { ...CREATE, specification: { vendor: 'x' } }), 400,
                'specification must be a string',
            )
        })

        it('maps the agent\'s rejections to 400: unknown location, unknown type, invalid JSON, duplicate name', async () => {
            await createEquipment(CREATE)
            const fresh = { ...CREATE, name: 'Other' }

            expectError(
                await setup.post('/api/equipment', { ...fresh, generalLocation: 'Moon' }), 400,
                'Moon is not a value of the wpGeneralLocation enum',
            )
            expectError(await setup.post('/api/equipment', { ...fresh, equipmentTypeId: 999 }), 400, 'Equipment type 999 does not exist')
            expectError(
                await setup.post('/api/equipment', { ...fresh, specification: '{not json' }), 400,
                'must be a string holding valid JSON',
            )
            expectError(await setup.post('/api/equipment', CREATE), 400, 'already exists')
            expect(await setup.count('Equipment')).toBe(1)
            expect(await setup.count('EquipmentLocation')).toBe(1)
        })

    })

    describe('POST /api/equipment/:equipmentId/location', () => {

        beforeEach(async () => {
            await createType(ENCLUSTRA.name)
            await createEquipment(CREATE)
        })

        it('moves the equipment: 201 with the updated entity, a new history row of the logged-in user, without username', async () => {
            const response = await setup.post('/api/equipment/1/location', {
                generalLocation: 'Prague',
                note: 'shipped',
                date: '2026-03-01',
            })

            expect(response).toEqual({ status: 201, body: { ...EQUIPMENT_1, generalLocation: 'Prague' } })
            expect(await setup.query(
                `select "generalLocation", to_char(date, 'YYYY-MM-DD') as date, note, username, "userId"
                 from main."EquipmentLocation" order by id`,
            )).toEqual([
                { generalLocation: 'CERN', date: await setup.today(), note: 'Location at creation', username: null, userId: E2E_ADMIN.id },
                { generalLocation: 'Prague', date: '2026-03-01', note: 'shipped', username: null, userId: E2E_ADMIN.id },
            ])
            expect((await setup.get('/api/equipment')).body).toEqual([{ ...EQUIPMENT_1, generalLocation: 'Prague' }])
        })

        it('takes the date as optional and ignores a username in the body (the BFF sends null)', async () => {
            const response = await setup.post('/api/equipment/1/location', { generalLocation: 'Prague', note: '', username: 'mallory' })

            expect(response.status).toBe(201)
            expect(await setup.query('select username from main."EquipmentLocation" where id = 2')).toEqual([{ username: null }])
        })

        it('answers 404 for unknown equipment, 400 for an unknown location or an invalid body', async () => {
            expectError(
                await setup.post('/api/equipment/999/location', { generalLocation: 'CERN', note: '' }), 404,
                'Equipment 999 not found',
            )
            expectError(await setup.post('/api/equipment/1/location', { generalLocation: 'Moon', note: '' }), 400, 'Moon is not a value')
            expectError(await setup.post('/api/equipment/1/location', {}), 400, 'generalLocation must be a string', 'note must be a string')
            expectError(
                await setup.post('/api/equipment/1/location', { generalLocation: 'CERN', note: '', date: '01.03.2026' }), 400,
                'date must be a valid ISO 8601 date string',
            )
            expect(await setup.count('EquipmentLocation')).toBe(1)
        })

    })

    describe('GET /api/equipment/:equipmentId/location-history', () => {

        beforeEach(async () => {
            await createType(ENCLUSTRA.name)
            await createEquipment(CREATE)
        })

        it('returns the history oldest first as a plain array of the record fields, the user ones last', async () => {
            await setup.post('/api/equipment/1/location', { generalLocation: 'Prague', note: 'moved', date: '2026-03-01' })

            const history = expectStatus(await setup.get<EpicEquipmentLocationHistoryRecord[]>('/api/equipment/1/location-history'), 200)

            expect(history).toEqual([
                {
                    equipmentId: 1, generalLocation: 'CERN', date: await setup.today(), note: 'Location at creation', username: null,
                    ...BY_ADMIN,
                },
                { equipmentId: 1, generalLocation: 'Prague', date: '2026-03-01', note: 'moved', username: null, ...BY_ADMIN },
            ])
            expect(Object.keys(history[0])).toEqual(['equipmentId', 'generalLocation', 'date', 'note', 'username', 'userId', 'userName'])
        })

        it('answers 404 for unknown equipment and 400 for an id that is no number', async () => {
            expectError(await setup.get('/api/equipment/999/location-history'), 404, 'Equipment 999 not found')
            expectError(await setup.get('/api/equipment/one/location-history'), 400, 'numeric string is expected')
        })

    })

    // ── The user of the session (#397) ────────────────────────────

    describe('The user of the session on the equipment history', () => {

        beforeEach(async () => {
            await createType(ENCLUSTRA.name)
            await createEquipment(CREATE)
        })

        it('stores the id of the logged-in user on the row of a move, and the history names that user', async () => {
            const anna = await setup.createUser({ login: 'anna', name: 'Anna Rossi', role: EpicUserRole.User })
            const session = await setup.login(anna.login, anna.password)

            expectStatus(await setup.as(session).post('/api/equipment/1/location', { generalLocation: 'Prague', note: 'moved' }), 201)

            expect(await setup.query('select "userId", username from main."EquipmentLocation" order by id')).toEqual([
                { userId: E2E_ADMIN.id, username: null },
                { userId: anna.id, username: null },
            ])
            const history = expectStatus(await setup.as(session).get<RowUser[]>('/api/equipment/1/location-history'), 200)
            expect(history.map(({ userId, userName }) => ({ userId, userName }))).toEqual([
                BY_ADMIN,
                { userId: anna.id, userName: 'Anna Rossi' },
            ])
        })

        it('gives two users two ids, and keeps the name of a user who was switched off later', async () => {
            const anna = await setup.createUser({ login: 'anna', name: 'Anna Rossi', role: EpicUserRole.User })
            const bruno = await setup.createUser({ login: 'bruno', name: 'Bruno Weber', role: EpicUserRole.Expert })
            for (const user of [anna, bruno]) {
                const session = await setup.login(user.login, user.password)
                const moved = await setup.as(session).post('/api/equipment/1/location', { generalLocation: 'Prague', note: user.login })
                expectStatus(moved, 201)
            }
            await setup.query('update main."SvtUser" set "isActive" = false where id = $1', [anna.id])

            const history = expectStatus(await setup.get<RowUser[]>('/api/equipment/1/location-history'), 200)

            expect(history.slice(1).map(({ userId, userName }) => ({ userId, userName }))).toEqual([
                { userId: anna.id, userName: 'Anna Rossi' },
                { userId: bruno.id, userName: 'Bruno Weber' },
            ])
            expect(anna.id).not.toBe(bruno.id)
        })

    })

})
