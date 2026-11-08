import { FilterQuery } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbSvtTestConfigInput } from '../svt-test-setups'

import { SvtDbSvtTestTypeConfigEntity } from './svt-db-svt-test-type-config.entity'


export type SvtDbSvtTestTypeConfigsFilter = {
    ids?: number[]
    testTypeId?: number
}

export type SvtDbSvtTestTypeConfigCreateInput = SvtDbSvtTestConfigInput & {
    testTypeId: number
}

/** Configurations of test types; `configBody` is loaded only by {@link findBody}. */
@Injectable()
export class SvtDbSvtTestTypeConfigsRepository {

    constructor(private readonly em: EntityManager) {
    }

    findAll(filter: SvtDbSvtTestTypeConfigsFilter = {}): Promise<SvtDbSvtTestTypeConfigEntity[]> {
        const where: FilterQuery<SvtDbSvtTestTypeConfigEntity> = {}
        if (filter.ids?.length) {
            where.id = { $in: filter.ids }
        }
        if (filter.testTypeId !== undefined) {
            where.testType = filter.testTypeId
        }
        return this.em.find(SvtDbSvtTestTypeConfigEntity, where, { orderBy: { id: 'asc' } })
    }

    findById(id: number): Promise<SvtDbSvtTestTypeConfigEntity | null> {
        return this.em.findOne(SvtDbSvtTestTypeConfigEntity, { id })
    }

    /** The configuration text exactly as stored; `null` when the configuration does not exist. */
    async findBody(id: number): Promise<string | null> {
        const config = await this.em.findOne(SvtDbSvtTestTypeConfigEntity, { id }, { populate: ['configBody'] })
        return config ? config.configBody : null
    }

    create(input: SvtDbSvtTestTypeConfigCreateInput): Promise<SvtDbSvtTestTypeConfigEntity> {
        return this.em.transactional(async (em) => {
            const config = em.create(SvtDbSvtTestTypeConfigEntity, {
                testType: input.testTypeId,
                name: input.name,
                note: input.note,
                configBody: input.configBody,
            })
            await em.flush()
            return config
        })
    }

}
