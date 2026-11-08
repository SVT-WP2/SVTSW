// @vitest-environment node
import { PostgreSqlDriver } from '@mikro-orm/postgresql'

import { SvtDbOrmConfig } from './models'
import { SvtDbNamingStrategy } from './svt-db-naming-strategy'
import { buildSvtDbOrmOptions } from './svt-db-orm-options'


const CONFIG: SvtDbOrmConfig = {
    host: 'db.example',
    port: 5500,
    user: 'postgres',
    password: 'secret',
    dbName: 'svt_sw_db',
    schema: 'main',
    debug: false,
}

class FakeEntity {

    id!: number

}

describe('buildSvtDbOrmOptions', () => {

    it('targets PostgreSQL with the given connection and schema', () => {
        const options = buildSvtDbOrmOptions(CONFIG, [FakeEntity])
        expect(options.driver).toBe(PostgreSqlDriver)
        expect(options).toMatchObject({
            host: 'db.example',
            port: 5500,
            user: 'postgres',
            password: 'secret',
            dbName: 'svt_sw_db',
            schema: 'main',
        })
    })

    it('keeps the camelCase identifiers and the constraint names of the database', () => {
        expect(buildSvtDbOrmOptions(CONFIG, []).namingStrategy).toBe(SvtDbNamingStrategy)
    })

    it('uses the explicit entity list without file discovery', () => {
        const options = buildSvtDbOrmOptions(CONFIG, [FakeEntity])
        expect(options.entities).toEqual([FakeEntity])
        expect(options.discovery).toEqual({ disableDynamicFileAccess: true, warnWhenNoEntities: false })
    })

    it('boots without a connection and never creates the database', () => {
        const options = buildSvtDbOrmOptions(CONFIG, [])
        expect(options.connect).toBe(false)
        expect(options.ensureDatabase).toBe(false)
        expect(options.allowGlobalContext).toBe(false)
        expect(options.forceUtcTimezone).toBe(true)
    })

    it('passes the debug flag through', () => {
        expect(buildSvtDbOrmOptions({ ...CONFIG, debug: true }, []).debug).toBe(true)
        expect(buildSvtDbOrmOptions(CONFIG, []).debug).toBe(false)
    })

})
