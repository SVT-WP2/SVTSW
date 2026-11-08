import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbAsicEntity } from '../asics'
import { SVT_DB_LOCATION_AT_CREATION_NOTE, SvtDbLocationInput, SvtDbPage, SvtDbPager } from '../common'
import { SvtDbGeneratedAsic } from '../wafer-maps'

import { SvtDbWaferLocationEntity } from './svt-db-wafer-location.entity'
import { SvtDbWaferEntity } from './svt-db-wafer.entity'


export type SvtDbWafersFilter = {
    ids?: number[]
}

export type SvtDbWaferCreateInput = {
    waferTypeId: number
    serialNumber: string
    batchNumber: number
    thinningDate: string | null
    dicingDate: string | null
    productionDate: string | null
    /** The initial location; also written as the first history row. */
    generalLocation: string
}

export type SvtDbWaferUpdateInput = Partial<Pick<SvtDbWaferEntity, 'thinningDate' | 'dicingDate' | 'productionDate'>>

/**
 * Wafers, their location history and the ASICs created with them. Runs on the request context the dispatcher
 * opens per message; every write is one transaction.
 */
@Injectable()
export class SvtDbWafersRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbWafersFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbWaferEntity>> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        const [items, totalCount] = await this.em.findAndCount(SvtDbWaferEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
    }

    findById(id: number): Promise<SvtDbWaferEntity | null> {
        return this.em.findOne(SvtDbWaferEntity, { id })
    }

    /**
     * Inserts the wafer, its first history row (`Location at creation`) and the ASICs `asicsFor` yields for the
     * new wafer, in one transaction: a duplicate serial number anywhere leaves nothing behind.
     */
    createWithLocationAndAsics(
        input: SvtDbWaferCreateInput,
        asicsFor: (wafer: SvtDbWaferEntity) => SvtDbGeneratedAsic[],
    ): Promise<SvtDbWaferEntity> {
        return this.em.transactional(async (em) => {
            const wafer = em.create(SvtDbWaferEntity, {
                waferType: input.waferTypeId,
                serialNumber: input.serialNumber,
                batchNumber: input.batchNumber,
                thinningDate: input.thinningDate,
                dicingDate: input.dicingDate,
                productionDate: input.productionDate,
                generalLocation: input.generalLocation,
            })
            await em.flush()

            em.create(SvtDbWaferLocationEntity, {
                wafer,
                generalLocation: input.generalLocation,
                note: SVT_DB_LOCATION_AT_CREATION_NOTE,
            })
            const asics = asicsFor(wafer)
            if (asics.length > 0) {
                await em.insertMany(SvtDbAsicEntity, asics.map((asic) => ({ wafer: wafer.id, ...asic })))
            }
            await em.flush()
            return wafer
        })
    }

    /** Updates the given fields; `null` when the wafer does not exist. */
    async update(id: number, patch: SvtDbWaferUpdateInput): Promise<SvtDbWaferEntity | null> {
        return this.em.transactional(async (em) => {
            const wafer = await em.findOne(SvtDbWaferEntity, { id })
            if (!wafer) {
                return null
            }
            em.assign(wafer, patch)
            await em.flush()
            return wafer
        })
    }

    /**
     * Appends a history row and makes it the wafer's current location (the row just written, not the newest
     * by date: `01-behaviour-decisions.md` §3). `null` when the wafer does not exist.
     */
    async appendLocation(waferId: number, location: SvtDbLocationInput): Promise<SvtDbWaferEntity | null> {
        return this.em.transactional(async (em) => {
            const wafer = await em.findOne(SvtDbWaferEntity, { id: waferId })
            if (!wafer) {
                return null
            }
            em.create(SvtDbWaferLocationEntity, {
                wafer,
                generalLocation: location.generalLocation,
                username: location.username ?? null,
                note: location.note ?? null,
                ...(location.date ? { date: location.date } : {}),
            })
            wafer.generalLocation = location.generalLocation
            await em.flush()
            return wafer
        })
    }

    /** The full history of a wafer, oldest first. */
    findLocationHistory(waferId: number): Promise<SvtDbWaferLocationEntity[]> {
        return this.em.find(SvtDbWaferLocationEntity, { wafer: waferId }, { orderBy: { id: 'asc' } })
    }

}
