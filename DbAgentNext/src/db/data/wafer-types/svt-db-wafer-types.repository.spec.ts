// @vitest-environment node
import 'reflect-metadata'

import { MikroORM } from '@mikro-orm/postgresql'

import { buildSvtDbOrmOptions, SvtDbOrmConfig } from '../../orm'

import { SvtDbWaferTypeMapEntity } from './svt-db-wafer-type-map.entity'
import { SvtDbWaferTypeEntity } from './svt-db-wafer-type.entity'


/**
 * Integration test against a database restored from `Dev/db-example/2026-11-08-backup_prod.dump` with the
 * migrations applied. Runs only when `SVT_DB_AGENT_TEST_DB_URL` is set, e.g.
 * `postgresql://postgres:postgres@localhost:5500/svt_sw_db`.
 */
const TEST_DB_URL = process.env.SVT_DB_AGENT_TEST_DB_URL

function configFromUrl(url: string): SvtDbOrmConfig {
    const parsed = new URL(url)
    return {
        host: parsed.hostname,
        port: Number(parsed.port || 5432),
        user: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
        dbName: parsed.pathname.replace(/^\//, ''),
        schema: 'main',
        debug: false,
    }
}

describe.skipIf(!TEST_DB_URL)('WaferType entities against the restored production dump', () => {

    let orm: MikroORM

    beforeAll(async () => {
        orm = await MikroORM.init(buildSvtDbOrmOptions(configFromUrl(TEST_DB_URL!), [SvtDbWaferTypeEntity, SvtDbWaferTypeMapEntity]))
    })

    afterAll(async () => {
        await orm?.close(true)
    })

    it('reads the ER2 wafer type with its map', async () => {
        const em = orm.em.fork()
        const waferTypes = await em.find(SvtDbWaferTypeEntity, {}, { populate: ['map'], orderBy: { id: 'asc' } })

        expect(waferTypes.length).toBeGreaterThanOrEqual(1)
        const er2 = waferTypes.find((waferType) => waferType.name === 'ER2')
        expect(er2).toMatchObject({
            engineeringRun: 'ER2',
            foundry: 'TowerSemiconductor',
            technology: 'TPSCo65',
        })
        expect(er2?.map).toBeDefined()
        // The stored text of the `json` column (SvtDbJsonTextType), parsed here only to look inside.
        expect(JSON.parse(er2!.map!.waferMap)).toMatchObject({ FileName: 'ER2WaferMap_v0.json' })
    })

    it('lets the database assign the identity id on insert (rolled back)', async () => {
        const em = orm.em.fork()
        await em.begin()
        try {
            const waferType = em.create(SvtDbWaferTypeEntity, {
                name: 'phase-2-insert-check',
                engineeringRun: 'ER1',
                foundry: 'TowerSemiconductor',
                technology: 'TPSCo65',
            })
            await em.flush()
            expect(waferType.id).toBeGreaterThan(1)
        }
        finally {
            await em.rollback()
        }
    })

    it('generates the quoted camelCase identifiers of the schema', () => {
        const em = orm.em.fork()
        const query = em.createQueryBuilder(SvtDbWaferTypeMapEntity, 'map').select('*').where({ waferType: 1 }).getQuery()

        expect(query).toContain('"main"."WaferTypeMap"')
        expect(query).toContain('"waferTypeId"')
    })

})
