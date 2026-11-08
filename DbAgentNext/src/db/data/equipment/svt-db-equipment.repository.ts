import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SVT_DB_LOCATION_AT_CREATION_NOTE, SvtDbLocationInput, SvtDbPage, SvtDbPager } from '../common'

import { SvtDbEquipmentLocationEntity } from './svt-db-equipment-location.entity'
import { SvtDbEquipmentEntity } from './svt-db-equipment.entity'


export type SvtDbEquipmentFilter = {
    ids?: number[]
}

export type SvtDbEquipmentCreateInput = {
    name: string
    equipmentTypeId: number
    /** The initial location; also written as the first history row. */
    generalLocation: string
    /** The specification as the client sent it (valid JSON), or `null`. */
    specification: string | null
}

/**
 * Equipment and its location history (the wafer pattern). Every write is one transaction on the request
 * context the dispatcher opens per message.
 */
@Injectable()
export class SvtDbEquipmentRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbEquipmentFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbEquipmentEntity>> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        const [items, totalCount] = await this.em.findAndCount(SvtDbEquipmentEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
    }

    findById(id: number): Promise<SvtDbEquipmentEntity | null> {
        return this.em.findOne(SvtDbEquipmentEntity, { id })
    }

    /** Inserts the equipment and its first history row (`Location at creation`) in one transaction. */
    createWithLocation(input: SvtDbEquipmentCreateInput): Promise<SvtDbEquipmentEntity> {
        return this.em.transactional(async (em) => {
            const equipment = em.create(SvtDbEquipmentEntity, {
                name: input.name,
                equipmentType: input.equipmentTypeId,
                generalLocation: input.generalLocation,
                specification: input.specification,
            })
            await em.flush()
            em.create(SvtDbEquipmentLocationEntity, {
                equipment,
                generalLocation: input.generalLocation,
                note: SVT_DB_LOCATION_AT_CREATION_NOTE,
            })
            await em.flush()
            return equipment
        })
    }

    /**
     * Appends a history row and makes it the equipment's current location (the row just written, not the
     * newest by date: `01-behaviour-decisions.md` §3). `null` when the equipment does not exist.
     */
    appendLocation(equipmentId: number, location: SvtDbLocationInput): Promise<SvtDbEquipmentEntity | null> {
        return this.em.transactional(async (em) => {
            const equipment = await em.findOne(SvtDbEquipmentEntity, { id: equipmentId })
            if (!equipment) {
                return null
            }
            em.create(SvtDbEquipmentLocationEntity, {
                equipment,
                generalLocation: location.generalLocation,
                username: location.username ?? null,
                note: location.note ?? null,
                ...(location.date ? { date: location.date } : {}),
            })
            equipment.generalLocation = location.generalLocation
            await em.flush()
            return equipment
        })
    }

    /** The full history of a piece of equipment, oldest first. */
    findLocationHistory(equipmentId: number): Promise<SvtDbEquipmentLocationEntity[]> {
        return this.em.find(SvtDbEquipmentLocationEntity, { equipment: equipmentId }, { orderBy: { id: 'asc' } })
    }

}
