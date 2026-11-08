import { FilterQuery } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { escapeLike, SvtDbPage, SvtDbPager } from '../common'

import { SvtDbChipBlockEntity } from './svt-db-chip-block.entity'


/** The `GetAllChipBlocks` filter of the contract; every member narrows the list, absent ones do not. */
export type SvtDbChipBlocksFilter = {
    ids?: number[]
    chipId?: number
    chipBlockTypes?: string[]
    /** Case-insensitive substring of the serial number. */
    serialNumber?: string
}

/** Read access to `ChipBlock`; the rows are written together with their chip by `SvtDbChipsRepository`. */
@Injectable()
export class SvtDbChipBlocksRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbChipBlocksFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbChipBlockEntity>> {
        const where: FilterQuery<SvtDbChipBlockEntity> = {}
        if (filter.ids?.length) {
            where.id = { $in: filter.ids }
        }
        if (filter.chipId !== undefined) {
            where.chip = filter.chipId
        }
        if (filter.chipBlockTypes?.length) {
            where.blockType = { $in: filter.chipBlockTypes }
        }
        if (filter.serialNumber) {
            where.serialNumber = { $ilike: `%${escapeLike(filter.serialNumber)}%` }
        }

        const [items, totalCount] = await this.em.findAndCount(SvtDbChipBlockEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
    }

}
