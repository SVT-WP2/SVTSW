import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbWaferTypeMapEntity } from './svt-db-wafer-type-map.entity'
import { SvtDbWaferTypeEntity } from './svt-db-wafer-type.entity'


export type SvtDbWaferTypesFilter = {
    ids?: number[]
}

export type SvtDbWaferTypeCreateInput = Pick<SvtDbWaferTypeEntity, 'name' | 'engineeringRun' | 'foundry' | 'technology'>

/**
 * Wafer types and their maps. Runs on the request context the dispatcher opens per message; writes are
 * transactional and the id comes back with `RETURNING`.
 */
@Injectable()
export class SvtDbWaferTypesRepository {

    constructor(private readonly em: EntityManager) {
    }

    findAll(filter: SvtDbWaferTypesFilter = {}): Promise<SvtDbWaferTypeEntity[]> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        return this.em.find(SvtDbWaferTypeEntity, where, { orderBy: { id: 'asc' } })
    }

    findById(id: number): Promise<SvtDbWaferTypeEntity | null> {
        return this.em.findOne(SvtDbWaferTypeEntity, { id })
    }

    findMap(waferTypeId: number): Promise<SvtDbWaferTypeMapEntity | null> {
        return this.em.findOne(SvtDbWaferTypeMapEntity, { waferType: waferTypeId })
    }

    /** Inserts the wafer type and its map in one transaction. */
    create(input: SvtDbWaferTypeCreateInput, waferMap: unknown): Promise<SvtDbWaferTypeEntity> {
        return this.em.transactional(async (em) => {
            const waferType = em.create(SvtDbWaferTypeEntity, input)
            em.create(SvtDbWaferTypeMapEntity, { waferType, waferMap })
            await em.flush()
            return waferType
        })
    }

}
