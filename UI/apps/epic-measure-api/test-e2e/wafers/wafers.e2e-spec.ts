import { EpicUserRole, EpicWafer, EpicWaferLocationHistoryRecord, EpicWaferType, EpicWaferTypeMap } from 'svt-ts-types'

import {
    createWafer,
    createWaferType,
    E2E_ADMIN,
    expectError,
    expectStatus,
    SMALL_WAFER_MAP,
    SMALL_WAFER_TYPE_CREATE,
    TestSetup,
    WAFER_LOCATION,
    waferCreate,
} from '../utils'


const SMALL_TYPE: EpicWaferType = { id: 1, name: 'Small', engineeringRun: 'ER1', foundry: 'TowerSemiconductor', technology: 'TPSCo65' }

const WAFER_1: EpicWafer = {
    id: 1,
    serialNumber: 'W-1',
    batchNumber: 7,
    thinningDate: null,
    dicingDate: null,
    productionDate: null,
    waferTypeId: 1,
    generalLocation: WAFER_LOCATION,
}

/** The user fields of a history row that the Admin of the suite wrote over HTTP. */
const BY_ADMIN = { userId: E2E_ADMIN.id, userName: E2E_ADMIN.name }

/** The user fields of a history record. */
type RowUser = { userId: number | null; userName: string | null }

describe('Wafers (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())
    beforeEach(() => setup.clearDatabase())

    // ── /api/wafer-types ──────────────────────────────────────────

    describe('GET /api/wafer-types', () => {

        it('lists the wafer types in id order, without their maps', async () => {
            expect(expectStatus(await setup.get('/api/wafer-types'), 200)).toEqual([])
            await createWaferType(setup)
            await createWaferType(setup, { ...SMALL_WAFER_TYPE_CREATE, name: 'Small 2', engineeringRun: 'ER2' })

            const types = expectStatus(await setup.get<EpicWaferType[]>('/api/wafer-types'), 200)

            expect(types).toEqual([SMALL_TYPE, { ...SMALL_TYPE, id: 2, name: 'Small 2', engineeringRun: 'ER2' }])
            expect(Object.keys(types[0])).toEqual(['id', 'name', 'engineeringRun', 'foundry', 'technology'])
        })

    })

    describe('POST /api/wafer-types', () => {

        it('creates the wafer type and its map: 201 with the type, without the map', async () => {
            const response = await setup.post('/api/wafer-types', SMALL_WAFER_TYPE_CREATE)

            expect(response).toEqual({ status: 201, body: SMALL_TYPE })
            expect(await setup.query(
                'select "waferTypeId", "waferMap"::jsonb = $1::jsonb as same from main."WaferTypeMap"',
                [SMALL_WAFER_MAP],
            ))
                .toEqual([{ waferTypeId: 1, same: true }])
        })

        it('validates the body: every member a string (BFF)', async () => {
            expectError(
                await setup.post('/api/wafer-types', {}), 400,
                'name must be a string', 'engineeringRun must be a string', 'foundry must be a string', 'technology must be a string',
                'waferMap must be a string',
            )
        })

        it('maps the agent\'s rejections to 400: invalid map, value outside an enum, duplicate name; writes nothing', async () => {
            await createWaferType(setup)
            const badMap = JSON.stringify({ Groups: { Group_0: [{ PosInGroup: 1, FamilyType: 'NOT_A_TYPE' }] }, MapGroups: {} })

            expectError(
                await setup.post('/api/wafer-types', { ...SMALL_WAFER_TYPE_CREATE, name: 'Bad', waferMap: badMap }), 400,
                'Unmatching PosInGroup index: 1 from expected 0 in group Group_0',
                'Asic Family type: NOT_A_TYPE is not part of enum value in the DB',
            )
            expectError(
                await setup.post('/api/wafer-types', { ...SMALL_WAFER_TYPE_CREATE, name: 'Bad', engineeringRun: 'ER99' }), 400,
                'ER99 is not a value of the engineeringRun enum',
            )
            expectError(await setup.post('/api/wafer-types', SMALL_WAFER_TYPE_CREATE), 400, 'already exists')
            expect(await setup.count('WaferType')).toBe(1)
            expect(await setup.count('WaferTypeMap')).toBe(1)
        })

    })

    describe('GET /api/wafer-types/:waferTypeId/wafer-map', () => {

        it('returns the stored map byte for byte as a JSON string', async () => {
            await createWaferType(setup)

            const response = await setup.get<EpicWaferTypeMap>('/api/wafer-types/1/wafer-map')

            expect(response).toEqual({ status: 200, body: { waferMap: SMALL_WAFER_MAP } })
        })

        it('answers 404 for a wafer type without a map and 400 for an id that is no number', async () => {
            expectError(await setup.get('/api/wafer-types/999/wafer-map'), 404, 'No wafer map for wafer type 999')
            expectError(await setup.get('/api/wafer-types/one/wafer-map'), 400, 'numeric string is expected')
        })

    })

    // ── /api/wafers ───────────────────────────────────────────────

    describe('GET /api/wafers', () => {

        beforeEach(() => createWaferType(setup))

        it('lists every wafer in id order as a plain array', async () => {
            expect(expectStatus(await setup.get('/api/wafers'), 200)).toEqual([])
            await createWafer(setup)
            await createWafer(setup, { serialNumber: 'W-2', thinningDate: '2026-01-15' })

            const wafers = expectStatus(await setup.get<EpicWafer[]>('/api/wafers'), 200)

            expect(wafers).toEqual([WAFER_1, { ...WAFER_1, id: 2, serialNumber: 'W-2', thinningDate: '2026-01-15' }])
            expect(Object.keys(wafers[0])).toEqual([
                'id', 'serialNumber', 'batchNumber', 'thinningDate', 'dicingDate', 'productionDate', 'waferTypeId', 'generalLocation',
            ])
        })

    })

    describe('GET /api/wafers/:waferId', () => {

        beforeEach(() => createWaferType(setup))

        it('returns the one wafer', async () => {
            await createWafer(setup)
            await createWafer(setup, { serialNumber: 'W-2' })

            expect(await setup.get('/api/wafers/2')).toEqual({ status: 200, body: { ...WAFER_1, id: 2, serialNumber: 'W-2' } })
        })

        it('answers 404 for an unknown wafer and 400 for an id that is no number', async () => {
            expectError(await setup.get('/api/wafers/999'), 404, 'Wafer does not exist: 999')
            expectError(await setup.get('/api/wafers/one'), 400, 'numeric string is expected')
        })

    })

    describe('POST /api/wafers', () => {

        beforeEach(() => createWaferType(setup))

        it('creates the wafer, its first location row and the ASICs of its map; echoes the dates', async () => {
            const response = await setup.post('/api/wafers', waferCreate({ thinningDate: '2026-01-15', dicingDate: '2026-02-01' }))

            expect(response).toEqual({ status: 201, body: { ...WAFER_1, thinningDate: '2026-01-15', dicingDate: '2026-02-01' } })
            expect(await setup.query('select "waferId", "generalLocation", date::text, username, note, "userId" from main."WaferLocation"'))
                .toEqual([{
                    waferId: 1,
                    generalLocation: WAFER_LOCATION,
                    date: await setup.today(),
                    username: null,
                    note: 'Location at creation',
                    userId: E2E_ADMIN.id,
                }])
            expect(await setup.query('select "serialNumber", "waferMapPosition", "familyType" from main."Asic" order by id')).toEqual([
                { serialNumber: 'W-1_0_0', waferMapPosition: '0_0', familyType: 'MOSAIX' },
                { serialNumber: 'W-1_0_1', waferMapPosition: '0_1', familyType: 'BABYMOSAIX' },
            ])
        })

        it('validates the body (BFF): required members and their types, ISO dates', async () => {
            expectError(
                await setup.post('/api/wafers', {}), 400,
                'serialNumber must be a string', 'batchNumber must be a number', 'waferTypeId must be a number',
            )
            expectError(
                await setup.post('/api/wafers', waferCreate({ thinningDate: '15.01.2026' })), 400,
                'thinningDate must be a valid ISO 8601 date string',
            )
            expect(await setup.count('Wafer')).toBe(0)
        })

        it('maps the agent\'s rejections to 400: missing or unknown location, unknown type, duplicate serial; writes nothing', async () => {
            await createWafer(setup)

            expectError(
                await setup.post('/api/wafers', waferCreate({ serialNumber: 'W-2', generalLocation: null })), 400,
                'generalLocation is required',
            )
            expectError(
                await setup.post('/api/wafers', waferCreate({ serialNumber: 'W-2', generalLocation: 'Moon' })), 400,
                'Moon is not a value',
            )
            expectError(
                await setup.post('/api/wafers', waferCreate({ serialNumber: 'W-2', waferTypeId: 999 })), 400,
                'Wafer type 999 does not exist',
            )
            expectError(await setup.post('/api/wafers', waferCreate()), 400, 'already exists')
            expect(await setup.count('Wafer')).toBe(1)
            expect(await setup.count('Asic')).toBe(2)
        })

    })

    describe('PATCH /api/wafers/:waferId', () => {

        beforeEach(async () => {
            await createWaferType(setup)
            await createWafer(setup)
        })

        it('updates the dates: 200 with the wafer, stored in the database', async () => {
            const response = await setup.patch('/api/wafers/1', { thinningDate: '2026-05-01', productionDate: '2025-12-24' })

            expect(response).toEqual({ status: 200, body: { ...WAFER_1, thinningDate: '2026-05-01', productionDate: '2025-12-24' } })
            expect(await setup.query('select "thinningDate"::text, "dicingDate"::text, "productionDate"::text from main."Wafer"'))
                .toEqual([{ thinningDate: '2026-05-01', dicingDate: null, productionDate: '2025-12-24' }])
        })

        it('clears a date with null', async () => {
            await setup.patch('/api/wafers/1', { dicingDate: '2026-02-01' })

            const response = await setup.patch('/api/wafers/1', { dicingDate: null })

            expect(response).toEqual({ status: 200, body: WAFER_1 })
        })

        it('drops members it does not update (location, serial number) instead of forwarding them', async () => {
            const response = await setup.patch('/api/wafers/1', { generalLocation: 'CERN', serialNumber: 'X', dicingDate: '2026-02-01' })

            expect(response).toEqual({ status: 200, body: { ...WAFER_1, dicingDate: '2026-02-01' } })
            expect(await setup.count('WaferLocation')).toBe(1)
        })

        it('answers 404 for an unknown wafer and 400 for a date that is no ISO date', async () => {
            expectError(await setup.patch('/api/wafers/999', { dicingDate: '2026-01-01' }), 404, 'Wafer 999 not found')
            expectError(
                await setup.patch('/api/wafers/1', { dicingDate: 'tomorrow' }), 400,
                'dicingDate must be a valid ISO 8601 date string',
            )
        })

    })

    describe('POST /api/wafers/:waferId/location', () => {

        beforeEach(async () => {
            await createWaferType(setup)
            await createWafer(setup)
        })

        it('moves the wafer: 201 with the updated wafer and a history row of the logged-in user, without username', async () => {
            const response = await setup.post('/api/wafers/1/location', {
                generalLocation: 'CERN',
                note: 'moved to the lab',
                date: '2026-03-01',
            })

            expect(response).toEqual({ status: 201, body: { ...WAFER_1, generalLocation: 'CERN' } })
            expect(await setup.query(
                'select "generalLocation", date::text, username, note, "userId" from main."WaferLocation" order by id',
            ))
                .toEqual([
                    { generalLocation: WAFER_LOCATION, date: await setup.today(), username: null, note: 'Location at creation', userId: 1 },
                    { generalLocation: 'CERN', date: '2026-03-01', username: null, note: 'moved to the lab', userId: 1 },
                ])
        })

        it('stamps the current day without a date', async () => {
            await setup.post('/api/wafers/1/location', { generalLocation: 'CERN', note: 'n' })

            expect(await setup.query('select date::text from main."WaferLocation" order by id desc limit 1'))
                .toEqual([{ date: await setup.today() }])
        })

        it('answers 404 for an unknown wafer and 400 for an unknown location or an invalid body', async () => {
            expectError(await setup.post('/api/wafers/999/location', { generalLocation: 'CERN', note: 'n' }), 404, 'Wafer 999 not found')
            expectError(await setup.post('/api/wafers/1/location', { generalLocation: 'Moon', note: 'n' }), 400, 'Moon is not a value')
            expectError(await setup.post('/api/wafers/1/location', {}), 400, 'generalLocation must be a string', 'note must be a string')
            expect(await setup.count('WaferLocation')).toBe(1)
        })

    })

    describe('GET /api/wafers/:waferId/location-history', () => {

        beforeEach(async () => {
            await createWaferType(setup)
            await createWafer(setup)
        })

        it('returns the history oldest first as a plain array of the record fields, the user ones last', async () => {
            await setup.post('/api/wafers/1/location', { generalLocation: 'CERN', note: 'moved', date: '2026-03-01' })

            const history = expectStatus(await setup.get<EpicWaferLocationHistoryRecord[]>('/api/wafers/1/location-history'), 200)

            expect(history).toEqual([
                {
                    waferId: 1, generalLocation: WAFER_LOCATION, date: await setup.today(), note: 'Location at creation', username: null,
                    ...BY_ADMIN,
                },
                { waferId: 1, generalLocation: 'CERN', date: '2026-03-01', note: 'moved', username: null, ...BY_ADMIN },
            ])
            expect(Object.keys(history[0])).toEqual(['waferId', 'generalLocation', 'date', 'note', 'username', 'userId', 'userName'])
        })

        it('answers 404 for an unknown wafer and 400 for an id that is no number', async () => {
            expectError(await setup.get('/api/wafers/999/location-history'), 404)
            expectError(await setup.get('/api/wafers/one/location-history'), 400, 'numeric string is expected')
        })

    })

    // ── The user of the session (#397) ────────────────────────────

    describe('The user of the session on the wafer history', () => {

        beforeEach(async () => {
            await createWaferType(setup)
            await createWafer(setup)
        })

        it('stores the id of the logged-in user on the row of a move, and the history names that user', async () => {
            const anna = await setup.createUser({ login: 'anna', name: 'Anna Rossi', role: EpicUserRole.User })
            const session = await setup.login(anna.login, anna.password)

            expectStatus(await setup.as(session).post('/api/wafers/1/location', { generalLocation: 'Prague', note: 'moved' }), 201)

            expect(await setup.query('select "userId", username from main."WaferLocation" order by id')).toEqual([
                { userId: E2E_ADMIN.id, username: null },
                { userId: anna.id, username: null },
            ])
            const history = expectStatus(await setup.as(session).get<RowUser[]>('/api/wafers/1/location-history'), 200)
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
                expectStatus(await setup.as(session).post('/api/wafers/1/location', { generalLocation: 'Prague', note: user.login }), 201)
            }
            await setup.query('update main."SvtUser" set "isActive" = false where id = $1', [anna.id])

            const history = expectStatus(await setup.get<RowUser[]>('/api/wafers/1/location-history'), 200)

            expect(history.slice(1).map(({ userId, userName }) => ({ userId, userName }))).toEqual([
                { userId: anna.id, userName: 'Anna Rossi' },
                { userId: bruno.id, userName: 'Bruno Weber' },
            ])
            expect(anna.id).not.toBe(bruno.id)
        })

    })

})
