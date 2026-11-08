import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

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
    /** The parsed JSON of the map; stored in the `json` column. */
    local2GlobalMap: unknown
}

@Injectable()
export class SvtDbWpProjectsRepository {

    constructor(private readonly em: EntityManager) {
    }

    findAll(filter: SvtDbWpProjectsFilter = {}): Promise<SvtDbWpProjectEntity[]> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        return this.em.find(SvtDbWpProjectEntity, where, { orderBy: { id: 'asc' } })
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
