import { FilterQuery } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbSvtTestSetupConfigEntity } from './svt-db-svt-test-setup-config.entity'
import { SvtDbSvtTestConfigInput } from './svt-db-svt-test-setups.repository'


export type SvtDbSvtTestSetupConfigsFilter = {
    ids?: number[]
    setupId?: number
}

export type SvtDbSvtTestSetupConfigCreateInput = SvtDbSvtTestConfigInput & {
    setupId: number
}

/** Configurations of test setups; `configBody` is loaded only by {@link findBody}. */
@Injectable()
export class SvtDbSvtTestSetupConfigsRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbSvtTestSetupConfigsFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbSvtTestSetupConfigEntity>> {
        const where: FilterQuery<SvtDbSvtTestSetupConfigEntity> = {}
        if (filter.ids?.length) {
            where.id = { $in: filter.ids }
        }
        if (filter.setupId !== undefined) {
            where.setup = filter.setupId
        }
        const [items, totalCount] = await this.em.findAndCount(SvtDbSvtTestSetupConfigEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
    }

    findById(id: number): Promise<SvtDbSvtTestSetupConfigEntity | null> {
        return this.em.findOne(SvtDbSvtTestSetupConfigEntity, { id })
    }

    /** The configuration text exactly as stored; `null` when the configuration does not exist. */
    async findBody(id: number): Promise<string | null> {
        const config = await this.em.findOne(SvtDbSvtTestSetupConfigEntity, { id }, { populate: ['configBody'] })
        return config ? config.configBody : null
    }

    create(input: SvtDbSvtTestSetupConfigCreateInput): Promise<SvtDbSvtTestSetupConfigEntity> {
        return this.em.transactional(async (em) => {
            const config = em.create(SvtDbSvtTestSetupConfigEntity, {
                setup: input.setupId,
                name: input.name,
                note: input.note,
                configBody: input.configBody,
            })
            await em.flush()
            return config
        })
    }

}
