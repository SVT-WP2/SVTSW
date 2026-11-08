import { FilterQuery } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbChipEntity } from '../chips'
import { escapeLike, SvtDbPage, SvtDbPager } from '../common'

import { SvtDbAsicEntity } from './svt-db-asic.entity'


/** The `GetAllAsics` filter of the contract; every member narrows the list, absent ones do not. */
export type SvtDbAsicsFilter = {
    ids?: number[]
    waferId?: number
    /** ASICs a chip was made from: at most one. */
    chipId?: number
    familyTypes?: string[]
    quality?: string
    /** Case-insensitive substring of the serial number. */
    serialNumber?: string
}

/** An ASIC with the id of the chip diced from it, `null` while there is none (the C++ LEFT JOIN). */
export type SvtDbAsicWithChip = {
    asic: SvtDbAsicEntity
    chipId: number | null
}

export type SvtDbAsicCreateInput = {
    waferId: number
    serialNumber: string
    familyType: string
    waferMapPosition: string
    quality: string
}

const EMPTY_PAGE: SvtDbPage<SvtDbAsicWithChip> = { items: [], totalCount: 0 }

@Injectable()
export class SvtDbAsicsRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbAsicsFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbAsicWithChip>> {
        // An empty list is no restriction (contract: 'empty / undefined => all').
        let ids = filter.ids?.length ? filter.ids : undefined
        if (filter.chipId !== undefined) {
            const chip = await this.em.findOne(SvtDbChipEntity, { id: filter.chipId })
            if (!chip) {
                return EMPTY_PAGE
            }
            ids = ids ? ids.filter((id) => id === chip.asic.id) : [chip.asic.id]
            if (ids.length === 0) {
                return EMPTY_PAGE
            }
        }

        const where: FilterQuery<SvtDbAsicEntity> = {}
        if (ids) {
            where.id = { $in: ids }
        }
        if (filter.waferId !== undefined) {
            where.wafer = filter.waferId
        }
        if (filter.familyTypes?.length) {
            where.familyType = { $in: filter.familyTypes }
        }
        if (filter.quality !== undefined) {
            where.quality = filter.quality
        }
        if (filter.serialNumber) {
            where.serialNumber = { $ilike: `%${escapeLike(filter.serialNumber)}%` }
        }

        const [asics, totalCount] = await this.em.findAndCount(SvtDbAsicEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        const chipIds = await this.chipIdsByAsic(asics.map((asic) => asic.id))
        return { items: asics.map((asic) => ({ asic, chipId: chipIds.get(asic.id) ?? null })), totalCount }
    }

    /** The ASICs with the given ids, in id order; ids without an ASIC are simply absent. */
    findByIds(ids: number[]): Promise<SvtDbAsicEntity[]> {
        if (ids.length === 0) {
            return Promise.resolve([])
        }
        return this.em.find(SvtDbAsicEntity, { id: { $in: ids } }, { orderBy: { id: 'asc' } })
    }

    async create(input: SvtDbAsicCreateInput): Promise<SvtDbAsicWithChip> {
        const asic = await this.em.transactional(async (em) => {
            const created = em.create(SvtDbAsicEntity, {
                wafer: input.waferId,
                serialNumber: input.serialNumber,
                familyType: input.familyType,
                waferMapPosition: input.waferMapPosition,
                quality: input.quality,
            })
            await em.flush()
            return created
        })
        return { asic, chipId: null }
    }

    /** One query for the whole page instead of the C++ agent's join; a chip references exactly one ASIC. */
    private async chipIdsByAsic(asicIds: number[]): Promise<Map<number, number>> {
        if (asicIds.length === 0) {
            return new Map()
        }
        const chips = await this.em.find(SvtDbChipEntity, { asic: { $in: asicIds } }, { fields: ['id', 'asic'] })
        return new Map(chips.map((chip) => [chip.asic.id, chip.id]))
    }

}
