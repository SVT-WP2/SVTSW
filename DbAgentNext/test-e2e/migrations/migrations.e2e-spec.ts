import { SVT_DB_MIGRATIONS } from '../../src/migrations'
import { TestSetup } from '../utils'


describe('Migrations at start (e2e)', () => {

    const setup = new TestSetup()

    beforeAll(() => setup.init())
    afterAll(() => setup.close())

    it('records every migration of the list in the database, in order', async () => {
        const rows = await setup.query<{ name: string }>('select name from main.mikro_orm_migrations order by id')

        expect(rows.map((row) => row.name)).toEqual(SVT_DB_MIGRATIONS.map((migration) => migration.name))
    })

    it('applies nothing at the next start', async () => {
        expect(await setup.migrate()).toEqual([])
    })

})

describe('Migrations at start, on a database that does not exist (e2e)', () => {

    const MISSING_DATABASE = 'svt_sw_db_missing_e2e_test'
    const setup = new TestSetup()
    const missing = new TestSetup({ env: { SVT_DB_AGENT_DB_NAME: MISSING_DATABASE } })

    beforeAll(async () => {
        await setup.init()
        // The precondition: an agent without the check creates the database, and it stays after that run.
        await setup.query(`drop database if exists "${MISSING_DATABASE}"`)
    })

    afterAll(async () => {
        await missing.close()
        await setup.close()
    })

    it('ends the start and does not create the database', async () => {
        await expect(missing.init()).rejects.toThrow(`database "${MISSING_DATABASE}" does not exist`)

        const databases = await setup.query(`select datname from pg_database where datname = '${MISSING_DATABASE}'`)
        expect(databases).toEqual([])
    })

})
