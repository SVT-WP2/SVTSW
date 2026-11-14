import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbEquipmentTypeEntity } from './svt-db-equipment-type.entity'


export type SvtDbEquipmentTypesFilter = {
    ids?: number[]
}

@Injectable()
export class SvtDbEquipmentTypesRepository {

    constructor(private readonly em: EntityManager) {
    }

    findAll(filter: SvtDbEquipmentTypesFilter = {}): Promise<SvtDbEquipmentTypeEntity[]> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        return this.em.find(SvtDbEquipmentTypeEntity, where, { orderBy: { id: 'asc' } })
    }

    findById(id: number): Promise<SvtDbEquipmentTypeEntity | null> {
        return this.em.findOne(SvtDbEquipmentTypeEntity, { id })
    }

    create(name: string): Promise<SvtDbEquipmentTypeEntity> {
        return this.em.transactional(async (em) => {
            const equipmentType = em.create(SvtDbEquipmentTypeEntity, { name })
            await em.flush()
            return equipmentType
        })
    }

}
