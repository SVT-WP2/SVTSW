import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbSvtTestConfigInput } from '../svt-test-setups'

import { SvtDbSvtTestTypeConfigEntity } from './svt-db-svt-test-type-config.entity'
import { SvtDbSvtTestTypeDutTypeEntity } from './svt-db-svt-test-type-dut-type.entity'
import { SvtDbSvtTestTypeEntity } from './svt-db-svt-test-type.entity'


export type SvtDbSvtTestTypesFilter = {
    ids?: number[]
    /** Test types that apply to any of these DUT types. */
    dutTypes?: string[]
}

/** A test type with its DUT types, in the enum's order; `[]` when it has none (R-4). */
export type SvtDbSvtTestTypeWithDutTypes = {
    testType: SvtDbSvtTestTypeEntity
    dutTypes: string[]
}

export type SvtDbSvtTestTypeCreateInput = {
    name: string
    dutTypes: string[]
    /** Created with the test type. */
    config: SvtDbSvtTestConfigInput
}

/** Test types with their DUT types; every write is one transaction. */
@Injectable()
export class SvtDbSvtTestTypesRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findAll(filter: SvtDbSvtTestTypesFilter = {}): Promise<SvtDbSvtTestTypeWithDutTypes[]> {
        let ids = filter.ids?.length ? filter.ids : undefined
        if (filter.dutTypes?.length) {
            const rows = await this.em.find(SvtDbSvtTestTypeDutTypeEntity, { dutType: { $in: filter.dutTypes } })
            const matching = new Set(rows.map((row) => row.testType.id))
            ids = ids ? ids.filter((id) => matching.has(id)) : [...matching]
            if (ids.length === 0) {
                return []
            }
        }
        const where = ids ? { id: { $in: ids } } : {}
        const testTypes = await this.em.find(SvtDbSvtTestTypeEntity, where, { orderBy: { id: 'asc' } })
        const dutTypes = await this.dutTypesByTestType(testTypes.map((testType) => testType.id))
        return testTypes.map((testType) => ({ testType, dutTypes: dutTypes.get(testType.id) ?? [] }))
    }

    async findById(id: number): Promise<SvtDbSvtTestTypeWithDutTypes | null> {
        const [found] = await this.findAll({ ids: [id] })
        return found ?? null
    }

    /** Test type, its DUT types and its first configuration, in one transaction. */
    createWithConfig(input: SvtDbSvtTestTypeCreateInput): Promise<SvtDbSvtTestTypeWithDutTypes> {
        return this.em.transactional(async (em) => {
            const testType = em.create(SvtDbSvtTestTypeEntity, { name: input.name })
            await em.flush()
            for (const dutType of unique(input.dutTypes)) {
                em.create(SvtDbSvtTestTypeDutTypeEntity, { dutType, testType })
            }
            em.create(SvtDbSvtTestTypeConfigEntity, {
                testType,
                name: input.config.name,
                note: input.config.note,
                configBody: input.config.configBody,
            })
            await em.flush()
            return (await this.findAllIn(em, testType.id)) ?? { testType, dutTypes: [] }
        })
    }

    /**
     * Replaces the DUT types of a test type with the given list (the C++ only ever appended, D-1). `null`
     * when the test type does not exist.
     */
    replaceDutTypes(id: number, dutTypes: string[]): Promise<SvtDbSvtTestTypeWithDutTypes | null> {
        return this.em.transactional(async (em) => {
            const testType = await em.findOne(SvtDbSvtTestTypeEntity, { id })
            if (!testType) {
                return null
            }
            await em.nativeDelete(SvtDbSvtTestTypeDutTypeEntity, { testType: id })
            for (const dutType of unique(dutTypes)) {
                em.create(SvtDbSvtTestTypeDutTypeEntity, { dutType, testType })
            }
            await em.flush()
            return this.findAllIn(em, id)
        })
    }

    private async findAllIn(em: EntityManager, id: number): Promise<SvtDbSvtTestTypeWithDutTypes | null> {
        const testType = await em.findOne(SvtDbSvtTestTypeEntity, { id })
        if (!testType) {
            return null
        }
        const rows = await em.find(SvtDbSvtTestTypeDutTypeEntity, { testType: id }, { orderBy: { dutType: 'asc' } })
        return { testType, dutTypes: rows.map((row) => row.dutType) }
    }

    private async dutTypesByTestType(testTypeIds: number[]): Promise<Map<number, string[]>> {
        const result = new Map<number, string[]>()
        if (testTypeIds.length === 0) {
            return result
        }
        const rows = await this.em.find(
            SvtDbSvtTestTypeDutTypeEntity,
            { testType: { $in: testTypeIds } },
            { orderBy: { dutType: 'asc' } },
        )
        for (const row of rows) {
            result.set(row.testType.id, [...(result.get(row.testType.id) ?? []), row.dutType])
        }
        return result
    }

}

function unique(values: string[]): string[] {
    return [...new Set(values)]
}
