import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbWpProbeCardFamilyTypeEntity } from './svt-db-wp-probe-card-family-type.entity'
import { SvtDbWpProbeCardEntity } from './svt-db-wp-probe-card.entity'


export type SvtDbWpProbeCardsFilter = {
    ids?: number[]
}

/** A probe card with the ASIC family types of `ProbeCardFamilyType`, in the enum's order (R-3). */
export type SvtDbWpProbeCardWithFamilyTypes = {
    probeCard: SvtDbWpProbeCardEntity
    asicFamilyTypes: string[]
}

/** Read access to probe cards; the contract has no write message for them yet. */
@Injectable()
export class SvtDbWpProbeCardsRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbWpProbeCardsFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbWpProbeCardWithFamilyTypes>> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        const [probeCards, totalCount] = await this.em.findAndCount(SvtDbWpProbeCardEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        const familyTypes = await this.familyTypesByProbeCard(probeCards.map((probeCard) => probeCard.id))
        const items = probeCards.map((probeCard) => ({ probeCard, asicFamilyTypes: familyTypes.get(probeCard.id) ?? [] }))
        return { items, totalCount }
    }

    findById(id: number): Promise<SvtDbWpProbeCardEntity | null> {
        return this.em.findOne(SvtDbWpProbeCardEntity, { id })
    }

    private async familyTypesByProbeCard(probeCardIds: number[]): Promise<Map<number, string[]>> {
        const result = new Map<number, string[]>()
        if (probeCardIds.length === 0) {
            return result
        }
        const rows = await this.em.find(
            SvtDbWpProbeCardFamilyTypeEntity,
            { probeCard: { $in: probeCardIds } },
            { orderBy: { asicFamilyType: 'asc' } },
        )
        for (const row of rows) {
            result.set(row.probeCard.id, [...(result.get(row.probeCard.id) ?? []), row.asicFamilyType])
        }
        return result
    }

}
