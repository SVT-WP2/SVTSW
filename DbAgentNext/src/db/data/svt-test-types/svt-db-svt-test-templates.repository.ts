import { FilterQuery } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbSvtTestTemplateEntity } from './svt-db-svt-test-template.entity'


export type SvtDbSvtTestTemplatesFilter = {
    ids?: number[]
    dutTypes?: string[]
}

/** A template with the test type of its configuration (the C++ agent's JOIN column). */
export type SvtDbSvtTestTemplateWithTestType = {
    template: SvtDbSvtTestTemplateEntity
    testTypeId: number
}

export type SvtDbSvtTestTemplateCreateInput = {
    dutType: string
    testTypeConfigId: number
    isEnabled: boolean
}

@Injectable()
export class SvtDbSvtTestTemplatesRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(
        filter: SvtDbSvtTestTemplatesFilter = {},
        pager?: SvtDbPager,
    ): Promise<SvtDbPage<SvtDbSvtTestTemplateWithTestType>> {
        const where: FilterQuery<SvtDbSvtTestTemplateEntity> = {}
        if (filter.ids?.length) {
            where.id = { $in: filter.ids }
        }
        if (filter.dutTypes?.length) {
            where.dutType = { $in: filter.dutTypes }
        }
        const [templates, totalCount] = await this.em.findAndCount(SvtDbSvtTestTemplateEntity, where, {
            populate: ['testTypeConfig'],
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items: templates.map(withTestType), totalCount }
    }

    async findById(id: number): Promise<SvtDbSvtTestTemplateWithTestType | null> {
        const template = await this.em.findOne(SvtDbSvtTestTemplateEntity, { id }, { populate: ['testTypeConfig'] })
        return template ? withTestType(template) : null
    }

    create(input: SvtDbSvtTestTemplateCreateInput): Promise<SvtDbSvtTestTemplateWithTestType> {
        return this.em.transactional(async (em) => {
            const template = em.create(SvtDbSvtTestTemplateEntity, {
                dutType: input.dutType,
                testTypeConfig: input.testTypeConfigId,
                isEnabled: input.isEnabled,
            })
            await em.flush()
            await em.populate(template, ['testTypeConfig'])
            return withTestType(template)
        })
    }

    /** `null` when the template does not exist. */
    update(id: number, patch: { isEnabled: boolean }): Promise<SvtDbSvtTestTemplateWithTestType | null> {
        return this.em.transactional(async (em) => {
            const template = await em.findOne(SvtDbSvtTestTemplateEntity, { id }, { populate: ['testTypeConfig'] })
            if (!template) {
                return null
            }
            em.assign(template, patch)
            await em.flush()
            return withTestType(template)
        })
    }

}

function withTestType(template: SvtDbSvtTestTemplateEntity): SvtDbSvtTestTemplateWithTestType {
    return { template, testTypeId: template.testTypeConfig.getEntity().testType.id }
}
