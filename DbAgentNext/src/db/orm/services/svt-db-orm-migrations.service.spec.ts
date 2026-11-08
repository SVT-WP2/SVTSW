// @vitest-environment node
import { MikroORM } from '@mikro-orm/core'
import { Logger } from '@nestjs/common'

import { SvtDbOrmMigrationsService } from './svt-db-orm-migrations.service'


describe('SvtDbOrmMigrationsService', () => {

    const up = vi.fn()
    const execute = vi.fn()
    const service = new SvtDbOrmMigrationsService({ migrator: { up }, em: { getConnection: () => ({ execute }) } } as unknown as MikroORM)
    let log: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        vi.clearAllMocks()
        log = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    })

    it('applies the pending migrations and returns their names', async () => {
        up.mockResolvedValue([{ name: 'Migration1' }, { name: 'Migration2' }])

        expect(await service.up()).toEqual(['Migration1', 'Migration2'])
        expect(log).toHaveBeenCalledWith('Applied 2 migration(s): Migration1, Migration2')
    })

    it('returns an empty list when no migration is pending', async () => {
        up.mockResolvedValue([])

        expect(await service.up()).toEqual([])
        expect(log).toHaveBeenCalledWith('No pending migration')
    })

    it('rejects before the migrator runs when the database does not answer: the migrator would create it', async () => {
        execute.mockRejectedValueOnce(new Error('database "svt_typo" does not exist'))

        await expect(service.up()).rejects.toThrow('database "svt_typo" does not exist')
        expect(execute).toHaveBeenCalledWith('select 1')
        expect(up).not.toHaveBeenCalled()
    })

    it('rejects when a migration fails, so that the start stops', async () => {
        up.mockRejectedValue(new Error('column "waferId" contains null values'))

        await expect(service.up()).rejects.toThrow('contains null values')
    })

})
