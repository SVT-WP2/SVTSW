// @vitest-environment node
import { readdirSync } from 'node:fs'
import { basename } from 'node:path'

import { SVT_DB_MIGRATIONS } from './svt-db-migrations'


describe('SVT_DB_MIGRATIONS', () => {

    it('lists every migration file of this folder, in the order of the timestamps', () => {
        const files = readdirSync(__dirname)
            .filter((file) => /^Migration\d+.*\.ts$/.test(file))
            .map((file) => basename(file, '.ts'))
            .sort()

        expect(SVT_DB_MIGRATIONS.map((migration) => migration.name)).toEqual(files)
    })

    it('names each migration as its class, the name that the MikroORM CLI records', () => {
        for (const migration of SVT_DB_MIGRATIONS) {
            expect(migration.class.name).toBe(migration.name)
        }
    })

})
