import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbEquipmentTypeEntity } from './svt-db-equipment-type.entity'


export type SvtDbEquipmentTypesFilter = {
    ids?: number[]
}

@Injectable()
export class SvtDbEquipmentTypesRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbEquipmentTypesFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbEquipmentTypeEntity>> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        const [items, totalCount] = await this.em.findAndCount(SvtDbEquipmentTypeEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
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
