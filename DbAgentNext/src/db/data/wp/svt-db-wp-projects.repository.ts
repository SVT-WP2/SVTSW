import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbWpProjectEntity } from './svt-db-wp-project.entity'


export type SvtDbWpProjectsFilter = {
    ids?: number[]
}

export type SvtDbWpProjectCreateInput = {
    wpMachineId: number
    waferTypeId: number
    name: string
    asicFamilyType: string
    orientation: string
    alignmentDie: string
    homeDie: string
    /** The map as the client sent it (valid JSON); stored in the `json` column as it is. */
    local2GlobalMap: string | null
}

@Injectable()
export class SvtDbWpProjectsRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbWpProjectsFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbWpProjectEntity>> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        const [items, totalCount] = await this.em.findAndCount(SvtDbWpProjectEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
    }

    create(input: SvtDbWpProjectCreateInput): Promise<SvtDbWpProjectEntity> {
        return this.em.transactional(async (em) => {
            const project = em.create(SvtDbWpProjectEntity, {
                wpMachine: input.wpMachineId,
                waferType: input.waferTypeId,
                name: input.name,
                asicFamilyType: input.asicFamilyType,
                orientation: input.orientation,
                alignmentDie: input.alignmentDie,
                homeDie: input.homeDie,
                local2GlobalMap: input.local2GlobalMap,
            })
            await em.flush()
            return project
        })
    }

}
