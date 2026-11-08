import { FilterQuery } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { escapeLike, SVT_DB_LOCATION_AT_CREATION_NOTE, SvtDbLocationInput, SvtDbPage, SvtDbPager } from '../common'

import { SvtDbAsicFamilyTypeBlockListEntity } from './svt-db-asic-family-type-block-list.entity'
import { generateChipBlocks } from './svt-db-chip-block-generation'
import { SvtDbChipBlockEntity } from './svt-db-chip-block.entity'
import { SvtDbChipLocationEntity } from './svt-db-chip-location.entity'
import { SvtDbChipEntity } from './svt-db-chip.entity'


/** The `GetAllChips` filter of the contract; every member narrows the list, absent ones do not. */
export type SvtDbChipsFilter = {
    ids?: number[]
    generalLocation?: string
    /** Case-insensitive substring of the serial number. */
    serialNumber?: string
    /** Family types of the ASIC the chip was made of. */
    familyTypes?: string[]
}

/** A chip with the family type of its ASIC, the virtual column of the C++ agent's list query. */
export type SvtDbChipWithFamilyType = {
    chip: SvtDbChipEntity
    familyType: string
}

export type SvtDbChipCreateInput = {
    asicId: number
    /** Family type of that ASIC; selects the block types when blocks are generated. */
    asicFamilyType: string
    serialNumber: string
    /** The initial location; also written as the first history row. */
    generalLocation: string
}

export type SvtDbChipCreateOptions = {
    /** Also write the `ChipBlock` rows `AsicFamilyTypeBlockList` lists for the chip's family type. */
    generateBlocks: boolean
}

/**
 * Chips, their location history and their blocks. Runs on the request context the dispatcher opens per
 * message; every write is one transaction.
 */
@Injectable()
export class SvtDbChipsRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbChipsFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbChipWithFamilyType>> {
        const where: FilterQuery<SvtDbChipEntity> = {}
        if (filter.ids?.length) {
            where.id = { $in: filter.ids }
        }
        if (filter.generalLocation !== undefined) {
            where.generalLocation = filter.generalLocation
        }
        if (filter.serialNumber) {
            where.serialNumber = { $ilike: `%${escapeLike(filter.serialNumber)}%` }
        }
        if (filter.familyTypes?.length) {
            where.asic = { familyType: { $in: filter.familyTypes } }
        }

        const [chips, totalCount] = await this.em.findAndCount(SvtDbChipEntity, where, {
            populate: ['asic'],
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items: chips.map(withFamilyType), totalCount }
    }

    async findById(id: number): Promise<SvtDbChipWithFamilyType | null> {
        const chip = await this.em.findOne(SvtDbChipEntity, { id }, { populate: ['asic'] })
        return chip ? withFamilyType(chip) : null
    }

    /** The chips made of the given ASICs, in id order (at most one per ASIC is the rule the handlers enforce). */
    findByAsicIds(asicIds: number[]): Promise<SvtDbChipEntity[]> {
        if (asicIds.length === 0) {
            return Promise.resolve([])
        }
        return this.em.find(SvtDbChipEntity, { asic: { $in: asicIds } }, { orderBy: { id: 'asc' } })
    }

    /** One chip; see {@link createMany}. */
    async create(input: SvtDbChipCreateInput, options: SvtDbChipCreateOptions): Promise<SvtDbChipWithFamilyType> {
        const [created] = await this.createMany([input], options)
        return created
    }

    /**
     * Inserts the chips, a `Location at creation` history row each and, with `generateBlocks`, their blocks,
     * all in one transaction: a duplicate serial number anywhere leaves nothing behind. Returns the chips in
     * input order.
     */
    createMany(inputs: SvtDbChipCreateInput[], options: SvtDbChipCreateOptions): Promise<SvtDbChipWithFamilyType[]> {
        return this.em.transactional(async (em) => {
            const blockTypesByFamily = options.generateBlocks
                ? await this.findBlockTypesByFamily(em, inputs.map((input) => input.asicFamilyType))
                : new Map<string, string[]>()

            const chips = inputs.map((input) => em.create(SvtDbChipEntity, {
                asic: input.asicId,
                serialNumber: input.serialNumber,
                generalLocation: input.generalLocation,
            }))
            await em.flush()

            chips.forEach((chip, index) => {
                em.create(SvtDbChipLocationEntity, {
                    chip,
                    generalLocation: chip.generalLocation,
                    note: SVT_DB_LOCATION_AT_CREATION_NOTE,
                })
                const blockTypes = blockTypesByFamily.get(inputs[index].asicFamilyType) ?? []
                for (const block of generateChipBlocks(chip.serialNumber, blockTypes)) {
                    em.create(SvtDbChipBlockEntity, { chip, blockType: block.blockType, serialNumber: block.serialNumber })
                }
            })
            await em.flush()

            return chips.map((chip, index) => ({ chip, familyType: inputs[index].asicFamilyType }))
        })
    }

    /**
     * Appends a history row and makes it the chip's current location (the row just written, not the newest
     * by date: `01-behaviour-decisions.md` §3). `null` when the chip does not exist.
     */
    async appendLocation(chipId: number, location: SvtDbLocationInput): Promise<SvtDbChipWithFamilyType | null> {
        return this.em.transactional(async (em) => {
            const chip = await em.findOne(SvtDbChipEntity, { id: chipId }, { populate: ['asic'] })
            if (!chip) {
                return null
            }
            em.create(SvtDbChipLocationEntity, {
                chip,
                generalLocation: location.generalLocation,
                username: location.username ?? null,
                note: location.note ?? null,
                ...(location.date ? { date: location.date } : {}),
            })
            chip.generalLocation = location.generalLocation
            await em.flush()
            return withFamilyType(chip)
        })
    }

    /** The full history of a chip, oldest first. */
    findLocationHistory(chipId: number): Promise<SvtDbChipLocationEntity[]> {
        return this.em.find(SvtDbChipLocationEntity, { chip: chipId }, { orderBy: { id: 'asc' } })
    }

    /** The block types of `AsicFamilyTypeBlockList` per family type, in the enum's order. */
    private async findBlockTypesByFamily(em: EntityManager, familyTypes: string[]): Promise<Map<string, string[]>> {
        const rows = await em.find(
            SvtDbAsicFamilyTypeBlockListEntity,
            { asicFamilyType: { $in: [...new Set(familyTypes)] } },
            { orderBy: { blockType: 'asc' } },
        )
        const result = new Map<string, string[]>()
        for (const row of rows) {
            result.set(row.asicFamilyType, [...(result.get(row.asicFamilyType) ?? []), row.blockType])
        }
        return result
    }

}

function withFamilyType(chip: SvtDbChipEntity): SvtDbChipWithFamilyType {
    return { chip, familyType: chip.asic.getEntity().familyType }
}
