import { EpicApiPageResponse, EpicSvtDutEntityName, EpicSvtTest, EpicSvtTestCreateRequest } from 'svt-ts-types'

import {
    createWafer,
    createWaferType,
    expectError,
    expectPageQueryParams,
    expectStatus,
    ISO_DATE_TIME,
    repeatedQuery,
    SVT_TEST_SETUP_CREATE,
    SVT_TEST_TYPE_CREATE,
    TestSetup,
} from '../utils'


const ASIC_TEST: EpicSvtTestCreateRequest = {
    dutEntityName: EpicSvtDutEntityName.Asic,
    dutId: 1,
    testTypeConfigId: 1,
    testSetupConfigId: 1,
}
const CHIP_TEST: EpicSvtTestCreateRequest = {
    dutEntityName: EpicSvtDutEntityName.Chip,
    dutId: 1,
    testTypeConfigId: 2,
    testSetupConfigId: 1,
}

/** A fresh test: nothing started or finished, no result, so the synthetic status is Pending. */
const FRESH = { startedAt: null, finishedAt: null, pathToResult: null, testResultStatus: null, status: 'Pending' }

type SvtTestPage = EpicApiPageResponse<EpicSvtTest>

describe('SVT tests (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    /** ASICs 1 and 2, chip 1 (of ASIC 1), test type 1 with configs 1 and 2, test setup 1 with config 1. */
    beforeEach(async () => {
        await setup.clearDatabase()
        await createWaferType(setup)
        await createWafer(setup)
        expectStatus(await setup.post('/api/chips', { serialNumber: 'C-1', asicId: 1, generalLocation: 'CERN' }), 201)
        expectStatus(await setup.post('/api/svt-test-types', SVT_TEST_TYPE_CREATE), 201)
        expectStatus(await setup.post('/api/svt-test-type-configs', {
            testTypeId: 1,
            name: 'Impedance Test float',
            configBody: '{}',
            note: null,
        }), 201)
        expectStatus(await setup.post('/api/svt-test-setups', SVT_TEST_SETUP_CREATE), 201)
    })

    async function createTest(create: EpicSvtTestCreateRequest): Promise<EpicSvtTest> {
        return expectStatus(await setup.post<EpicSvtTest>('/api/svt-tests', create), 201)
    }

    async function ids(query = ''): Promise<number[]> {
        const body = expectStatus(await setup.get<SvtTestPage>(`/api/svt-tests${query}`), 200)
        expect(body.totalCount).toBe(body.items.length)
        return body.items.map((item) => item.id)
    }

    /** The BFF has no start/finish endpoints (the test agents report those): the timestamps and results go in with SQL. */
    async function setRun(id: number, run: { startedAt?: string; finishedAt?: string; testResultStatus?: string }): Promise<void> {
        await setup.query(
            `update main."SvtTestList" set "startedAt" = coalesce($2, "startedAt"), "finishedAt" = coalesce($3, "finishedAt"),
             "testResultStatus" = coalesce($4, "testResultStatus"), "pathToResult" = coalesce($5, "pathToResult") where id = $1`,
            [
                id, run.startedAt ?? null, run.finishedAt ?? null, run.testResultStatus ?? null,
                run.testResultStatus ? `/results/${id}` : null,
            ],
        )
    }

    /**
     * Tests 1–6 on ASIC 1 unless noted: 1 Pending, 2 SUCCESS (Chip 1, config 2), 3 PARTIAL_SUCCESS, 4 FAILURE, 5 ERROR,
     * 6 CANCELLED (ASIC 2).
     */
    async function seedResults(): Promise<void> {
        await createTest(ASIC_TEST)
        await createTest(CHIP_TEST)
        for (const status of ['PARTIAL_SUCCESS', 'FAILURE', 'ERROR']) {
            void status
            await createTest(ASIC_TEST)
        }
        await createTest({ ...ASIC_TEST, dutId: 2 })
        const results = ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILURE', 'ERROR', 'CANCELLED']
        for (const [index, testResultStatus] of results.entries()) {
            await setRun(index + 2, { finishedAt: '2026-03-01T12:00:00Z', testResultStatus })
        }
    }

    describe('POST /api/svt-tests', () => {

        it('creates the test: 201 with its device, createdAt stamped by the database and the status Pending', async () => {
            const response = await setup.post<EpicSvtTest>('/api/svt-tests', ASIC_TEST)

            expect(response)
                .toEqual({ status: 201, body: { id: 1, ...ASIC_TEST, createdAt: expect.stringMatching(ISO_DATE_TIME), ...FRESH } })
            expect(Object.keys(response.body)).toEqual([
                'id', 'dutEntityName', 'dutId', 'testTypeConfigId', 'testSetupConfigId', 'createdAt', 'startedAt', 'finishedAt',
                'pathToResult', 'testResultStatus', 'status',
            ])
            expect(await setup.query('select "testId", "dutEntityName" from main."SvtTestListToEntityName"'))
                .toEqual([{ testId: 1, dutEntityName: 'Asic' }])
            expect(await setup.query('select "testId", "dutId" from main."SvtTestListToEntityId"')).toEqual([{ testId: 1, dutId: 1 }])
        })

        it('accepts a chip as the device', async () => {
            expect(await createTest(CHIP_TEST)).toMatchObject({ id: 1, dutEntityName: 'Chip', dutId: 1, status: 'Pending' })
        })

        it('validates the body: every member required with its type (BFF)', async () => {
            expectError(
                await setup.post('/api/svt-tests', {}), 400,
                'dutEntityName must be a string',
                'dutId must be a number',
                'testTypeConfigId must be a number',
                'testSetupConfigId must be a number',
            )
        })

        it('maps the agent\'s rejections to 400: device name, unknown device or configs; writes nothing', async () => {
            expectError(
                await setup.post('/api/svt-tests', { ...ASIC_TEST, dutEntityName: 'Wafer' }), 400,
                'Wafer is not a value of the dutEntityName enum',
            )
            expectError(await setup.post('/api/svt-tests', { ...ASIC_TEST, dutId: 999 }), 400, 'Asic 999 does not exist')
            expectError(await setup.post('/api/svt-tests', { ...ASIC_TEST, dutEntityName: 'Chip', dutId: 2 }), 400, 'Chip 2 does not exist')
            expectError(await setup.post('/api/svt-tests', { ...ASIC_TEST, dutEntityName: 'ChipBlock' }), 400, 'ChipBlock 1 does not exist')
            expectError(
                await setup.post('/api/svt-tests', { ...ASIC_TEST, testTypeConfigId: 999 }), 400,
                'Test type config 999 does not exist',
            )
            expectError(
                await setup.post('/api/svt-tests', { ...ASIC_TEST, testSetupConfigId: 999 }), 400,
                'Test setup config 999 does not exist',
            )
            expect(await setup.count('SvtTestList')).toBe(0)
        })

    })

    describe('GET /api/svt-tests', () => {

        it('answers a page of the tests newest first, each with its synthetic status', async () => {
            const first = await createTest(ASIC_TEST)
            const second = await createTest(CHIP_TEST)

            const body = expectStatus(await setup.get<SvtTestPage>('/api/svt-tests'), 200)

            expect(body).toEqual({ items: [second, first], totalCount: 2 })
            expect(body.items[0]).toEqual({ id: 2, ...CHIP_TEST, createdAt: expect.stringMatching(ISO_DATE_TIME), ...FRESH })
        })

        it('resolves the status from the stored result: SUCCESS and PARTIAL_SUCCESS Completed, FAILURE and ERROR Failed', async () => {
            await seedResults()

            const body = expectStatus(await setup.get<SvtTestPage>('/api/svt-tests'), 200)

            expect(body.items.map(({ id, testResultStatus, status }) => ({ id, testResultStatus, status }))).toEqual([
                { id: 6, testResultStatus: 'CANCELLED', status: 'Cancelled' },
                { id: 5, testResultStatus: 'ERROR', status: 'Failed' },
                { id: 4, testResultStatus: 'FAILURE', status: 'Failed' },
                { id: 3, testResultStatus: 'PARTIAL_SUCCESS', status: 'Completed' },
                { id: 2, testResultStatus: 'SUCCESS', status: 'Completed' },
                { id: 1, testResultStatus: null, status: 'Pending' },
            ])
            expect(body.items[0]).toMatchObject({ finishedAt: '2026-03-01T12:00:00.000Z', pathToResult: '/results/6' })
        })

        it('filters by ids: one, several (repeated, comma-separated, bracketed), more than 20; rejects non-integers', async () => {
            await seedResults()

            expect(await ids('?ids=2')).toEqual([2])
            expect(await ids('?ids=1&ids=3')).toEqual([3, 1])
            expect(await ids('?ids=1,3')).toEqual([3, 1])
            expect(await ids('?ids[]=1&ids[]=3')).toEqual([3, 1])
            expect(await ids(`?${repeatedQuery('ids', Array.from({ length: 25 }, (_, index) => index + 1))}`)).toEqual([6, 5, 4, 3, 2, 1])
            expectError(await setup.get('/api/svt-tests?ids=one'), 400, 'each value in ids must be an integer number')
        })

        it('filters by dutEntityNames and dutId, alone and combined', async () => {
            await seedResults()

            expect(await ids('?dutEntityNames=Chip')).toEqual([2])
            expect(await ids('?dutEntityNames=Asic')).toEqual([6, 5, 4, 3, 1])
            expect(await ids('?dutEntityNames=Chip&dutEntityNames=ChipBlock')).toEqual([2])
            expect(await ids('?dutId=2')).toEqual([6])
            expect(await ids('?dutId=1')).toEqual([5, 4, 3, 2, 1])
            expect(await ids('?dutEntityNames=Asic&dutId=1')).toEqual([5, 4, 3, 1])
            expect(await ids('?dutEntityNames=ChipBlock&dutId=1')).toEqual([])
            expectError(await setup.get('/api/svt-tests?dutId=one'), 400, 'dutId must be a number')
        })

        it('filters by statuses in the synthetic vocabulary, resolved to the stored results', async () => {
            await seedResults()

            expect(await ids('?statuses=Pending')).toEqual([1])
            expect(await ids('?statuses=Completed')).toEqual([3, 2])
            expect(await ids('?statuses=Failed')).toEqual([5, 4])
            expect(await ids('?statuses=Cancelled')).toEqual([6])
            expect(await ids('?statuses=Pending&statuses=Completed')).toEqual([3, 2, 1])
            expect(await ids('?statuses=Failed,Cancelled')).toEqual([6, 5, 4])
            expect(await ids('?statuses=Running')).toEqual([])
            expect(await ids('?statuses=Running&statuses=Pending')).toEqual([1])
        })

        it('rejects a status outside EpicSvtTestStatus instead of answering an empty list', async () => {
            await seedResults()

            expectError(await setup.get('/api/svt-tests?statuses=Done'), 400, 'each value in statuses must be one of the following values')
            expectError(await setup.get('/api/svt-tests?statuses=SUCCESS'), 400, 'statuses')
        })

        it('filters by testTypeConfigIds and testSetupConfigIds', async () => {
            await seedResults()

            expect(await ids('?testTypeConfigIds=2')).toEqual([2])
            expect(await ids('?testTypeConfigIds=1&testTypeConfigIds=2')).toEqual([6, 5, 4, 3, 2, 1])
            expect(await ids('?testSetupConfigIds=1')).toEqual([6, 5, 4, 3, 2, 1])
            expect(await ids('?testSetupConfigIds=999')).toEqual([])
            expectError(
                await setup.get('/api/svt-tests?testTypeConfigIds=one'), 400,
                'each value in testTypeConfigIds must be an integer number',
            )
        })

        it('filters by the createdAt, startedAt and finishedAt ranges: From inclusive, To exclusive, unset never matches', async () => {
            await createTest(ASIC_TEST)
            await createTest(CHIP_TEST)
            await setRun(1, { startedAt: '2026-03-01T10:00:00Z' })
            await setRun(2, { startedAt: '2026-03-02T10:00:00Z', finishedAt: '2026-03-02T11:00:00Z', testResultStatus: 'SUCCESS' })

            expect(await ids('?startedAtFrom=2026-03-02T10:00:00Z')).toEqual([2])
            expect(await ids('?startedAtTo=2026-03-02T10:00:00Z')).toEqual([1])
            expect(await ids('?startedAtFrom=2026-03-01T10:00:00Z&startedAtTo=2026-03-02T10:00:00Z')).toEqual([1])
            expect(await ids('?finishedAtFrom=2026-03-01T00:00:00Z')).toEqual([2])
            expect(await ids('?finishedAtTo=2026-03-02T11:00:00Z')).toEqual([])
            expect(await ids('?createdAtFrom=2000-01-01T00:00:00Z')).toEqual([2, 1])
            expect(await ids('?createdAtTo=2000-01-01T00:00:00Z')).toEqual([])
            expect(await ids('?createdAtFrom=2000-01-01&createdAtTo=2999-01-01')).toEqual([2, 1])
        })

        it('rejects a range bound that is no ISO 8601 date', async () => {
            for (const key of ['createdAtFrom', 'createdAtTo', 'startedAtFrom', 'startedAtTo', 'finishedAtFrom', 'finishedAtTo']) {
                expectError(await setup.get(`/api/svt-tests?${key}=yesterday`), 400, `${key} must be a valid ISO 8601 date string`)
            }
        })

        it('pages: limit and offset, validation of both; 40 tests without a limit', async () => {
            await createTest(ASIC_TEST)
            await createTest(CHIP_TEST)
            const [second, first] = expectStatus(await setup.get<SvtTestPage>('/api/svt-tests'), 200).items
            await expectPageQueryParams(setup, '/api/svt-tests', [second, first])
            expect((await setup.get('/api/svt-tests?statuses=Pending&limit=1&offset=1')).body).toEqual({ items: [first], totalCount: 2 })

            for (let index = 0; index < 39; index++) {
                await createTest(ASIC_TEST)
            }
            const body = expectStatus(await setup.get<SvtTestPage>('/api/svt-tests'), 200)
            expect(body.totalCount).toBe(41)
            expect(body.items).toHaveLength(40)
            expect(body.items[0].id).toBe(41)
        })

    })

    describe('GET /api/svt-tests/:id', () => {

        it('returns the one test with its status; 404 for an unknown one, 400 for an id that is no number', async () => {
            await seedResults()

            expect(await setup.get('/api/svt-tests/5')).toEqual({
                status: 200,
                body: {
                    id: 5, ...ASIC_TEST, createdAt: expect.stringMatching(ISO_DATE_TIME), startedAt: null,
                    finishedAt: '2026-03-01T12:00:00.000Z', pathToResult: '/results/5', testResultStatus: 'ERROR', status: 'Failed',
                },
            })
            expectError(await setup.get('/api/svt-tests/999'), 404, 'SvtTest does not exist: 999')
            expectError(await setup.get('/api/svt-tests/one'), 400, 'numeric string is expected')
        })

    })

})
