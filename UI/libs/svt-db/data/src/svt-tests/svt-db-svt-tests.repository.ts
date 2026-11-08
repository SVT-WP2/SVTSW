import { FilterQuery } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbSvtTestDutEntityNameEntity } from './svt-db-svt-test-dut-entity-name.entity'
import { SvtDbSvtTestDutIdEntity } from './svt-db-svt-test-dut-id.entity'
import { SvtDbSvtTestEntity } from './svt-db-svt-test.entity'


/** The `GetAllSvtTests` filter of the contract; every member narrows the list, absent ones do not. */
export type SvtDbSvtTestsFilter = {
    ids?: number[]
    dutEntityNames?: string[]
    /** Meant to be combined with `dutEntityNames`: DUT ids are unique per DUT entity only. */
    dutId?: number
    testResultStatuses?: string[]
    testTypeConfigIds?: number[]
    testSetupConfigIds?: number[]
    /** Range bounds: `From` inclusive, `To` exclusive. A test whose timestamp is NULL never matches a bound. */
    createdAtFrom?: Date
    createdAtTo?: Date
    startedAtFrom?: Date
    startedAtTo?: Date
    finishedAtFrom?: Date
    finishedAtTo?: Date
}

/** A test with its device, `null`s when a link row is missing (the C++ failed the whole list: Q-R2). */
export type SvtDbSvtTestWithDut = {
    test: SvtDbSvtTestEntity
    dutEntityName: string | null
    dutId: number | null
}

export type SvtDbSvtTestCreateInput = {
    dutEntityName: string
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
}

export type SvtDbSvtTestUpdateInput = Partial<Pick<SvtDbSvtTestEntity, 'startedAt' | 'finishedAt' | 'pathToResult' | 'testResultStatus'>>

type TimestampRange = { $gte?: Date; $lt?: Date }

const EMPTY_PAGE: SvtDbPage<SvtDbSvtTestWithDut> = { items: [], totalCount: 0 }

/** SVT test runs with their device links; every write is one transaction. Lists come newest first. */
@Injectable()
export class SvtDbSvtTestsRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbSvtTestsFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbSvtTestWithDut>> {
        let ids = filter.ids?.length ? filter.ids : undefined
        if (filter.dutEntityNames?.length) {
            const rows = await this.em.find(SvtDbSvtTestDutEntityNameEntity, { dutEntityName: { $in: filter.dutEntityNames } })
            ids = intersect(ids, rows.map((row) => row.test.id))
            if (ids.length === 0) {
                return EMPTY_PAGE
            }
        }
        if (filter.dutId !== undefined) {
            const rows = await this.em.find(SvtDbSvtTestDutIdEntity, { dutId: filter.dutId })
            ids = intersect(ids, rows.map((row) => row.test.id))
            if (ids.length === 0) {
                return EMPTY_PAGE
            }
        }

        const where: FilterQuery<SvtDbSvtTestEntity> = {}
        if (ids) {
            where.id = { $in: ids }
        }
        if (filter.testResultStatuses?.length) {
            where.testResultStatus = { $in: filter.testResultStatuses }
        }
        if (filter.testTypeConfigIds?.length) {
            where.testTypeConfig = { $in: filter.testTypeConfigIds }
        }
        if (filter.testSetupConfigIds?.length) {
            where.testSetupConfig = { $in: filter.testSetupConfigIds }
        }
        const createdAt = range(filter.createdAtFrom, filter.createdAtTo)
        if (createdAt) {
            where.createdAt = createdAt
        }
        const startedAt = range(filter.startedAtFrom, filter.startedAtTo)
        if (startedAt) {
            where.startedAt = startedAt
        }
        const finishedAt = range(filter.finishedAtFrom, filter.finishedAtTo)
        if (finishedAt) {
            where.finishedAt = finishedAt
        }

        const [tests, totalCount] = await this.em.findAndCount(SvtDbSvtTestEntity, where, {
            orderBy: { id: 'desc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items: await this.withDuts(tests), totalCount }
    }

    async findById(id: number): Promise<SvtDbSvtTestWithDut | null> {
        const test = await this.em.findOne(SvtDbSvtTestEntity, { id })
        if (!test) {
            return null
        }
        const [found] = await this.withDuts([test])
        return found
    }

    /** The test and its two device link rows, in one transaction; `createdAt` comes back from the database. */
    create(input: SvtDbSvtTestCreateInput): Promise<SvtDbSvtTestWithDut> {
        return this.em.transactional(async (em) => {
            const test = em.create(SvtDbSvtTestEntity, {
                testTypeConfig: input.testTypeConfigId,
                testSetupConfig: input.testSetupConfigId,
            })
            await em.flush()
            em.create(SvtDbSvtTestDutEntityNameEntity, { test, dutEntityName: input.dutEntityName })
            em.create(SvtDbSvtTestDutIdEntity, { test, dutId: input.dutId })
            await em.flush()
            await em.refresh(test)
            return { test, dutEntityName: input.dutEntityName, dutId: input.dutId }
        })
    }

    /** Sets the given fields; `null` when the test does not exist. */
    update(id: number, patch: SvtDbSvtTestUpdateInput): Promise<SvtDbSvtTestWithDut | null> {
        return this.em.transactional(async (em) => {
            const test = await em.findOne(SvtDbSvtTestEntity, { id })
            if (!test) {
                return null
            }
            em.assign(test, patch)
            await em.flush()
            const [found] = await this.withDuts([test])
            return found
        })
    }

    private async withDuts(tests: SvtDbSvtTestEntity[]): Promise<SvtDbSvtTestWithDut[]> {
        if (tests.length === 0) {
            return []
        }
        const testIds = tests.map((test) => test.id)
        const names = await this.em.find(SvtDbSvtTestDutEntityNameEntity, { test: { $in: testIds } })
        const dutIds = await this.em.find(SvtDbSvtTestDutIdEntity, { test: { $in: testIds } })
        const nameByTest = new Map(names.map((row) => [row.test.id, row.dutEntityName]))
        const dutIdByTest = new Map(dutIds.map((row) => [row.test.id, row.dutId]))
        return tests.map((test) => ({
            test,
            dutEntityName: nameByTest.get(test.id) ?? null,
            dutId: dutIdByTest.get(test.id) ?? null,
        }))
    }

}

function intersect(ids: number[] | undefined, found: number[]): number[] {
    const set = new Set(found)
    return ids ? ids.filter((id) => set.has(id)) : [...set]
}

/** `From` inclusive, `To` exclusive; `undefined` when neither bound is given. */
function range(from?: Date, to?: Date): TimestampRange | undefined {
    if (from === undefined && to === undefined) {
        return undefined
    }
    return {
        ...(from === undefined ? {} : { $gte: from }),
        ...(to === undefined ? {} : { $lt: to }),
    }
}
