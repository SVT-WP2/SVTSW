import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbSvtTestSetupConfigEntity } from './svt-db-svt-test-setup-config.entity'
import { SvtDbSvtTestSetupDefaultConfigEntity } from './svt-db-svt-test-setup-default-config.entity'
import { SvtDbSvtTestSetupEntity } from './svt-db-svt-test-setup.entity'


export type SvtDbSvtTestSetupsFilter = {
    ids?: number[]
}

/** A setup with the id of its default configuration, `null` when it has none. */
export type SvtDbSvtTestSetupWithDefault = {
    setup: SvtDbSvtTestSetupEntity
    defaultConfigId: number | null
}

export type SvtDbSvtTestConfigInput = {
    name: string
    /** The configuration text, already checked to be JSON. */
    configBody: string
    note: string | null
}

export type SvtDbSvtTestSetupCreateInput = {
    name: string
    generalLocation: string
    /** Created with the setup and made its default. */
    defaultConfig: SvtDbSvtTestConfigInput
}

/** Test setups and their default configuration; every write is one transaction. */
@Injectable()
export class SvtDbSvtTestSetupsRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbSvtTestSetupsFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbSvtTestSetupWithDefault>> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        const [setups, totalCount] = await this.em.findAndCount(SvtDbSvtTestSetupEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        const defaults = await this.defaultConfigIds(setups.map((setup) => setup.id))
        const items = setups.map((setup) => ({ setup, defaultConfigId: defaults.get(setup.id) ?? null }))
        return { items, totalCount }
    }

    async findById(id: number): Promise<SvtDbSvtTestSetupWithDefault | null> {
        const { items: [found] } = await this.findPage({ ids: [id] })
        return found ?? null
    }

    /** Setup, its first configuration and the default-configuration row, in one transaction. */
    createWithDefaultConfig(input: SvtDbSvtTestSetupCreateInput): Promise<SvtDbSvtTestSetupWithDefault> {
        return this.em.transactional(async (em) => {
            const setup = em.create(SvtDbSvtTestSetupEntity, { name: input.name, generalLocation: input.generalLocation })
            await em.flush()
            const config = em.create(SvtDbSvtTestSetupConfigEntity, {
                setup,
                name: input.defaultConfig.name,
                note: input.defaultConfig.note,
                configBody: input.defaultConfig.configBody,
            })
            await em.flush()
            em.create(SvtDbSvtTestSetupDefaultConfigEntity, { setup, defaultConfig: config })
            await em.flush()
            return { setup, defaultConfigId: config.id }
        })
    }

    /**
     * Makes `configId` the setup's default, creating the default-configuration row when the setup has none
     * (Q-U1: the C++ updated zero rows and replied Success). `null` when the setup does not exist; the
     * caller checks that the configuration exists and belongs to the setup.
     */
    setDefaultConfig(setupId: number, configId: number): Promise<SvtDbSvtTestSetupWithDefault | null> {
        return this.em.transactional(async (em) => {
            const setup = await em.findOne(SvtDbSvtTestSetupEntity, { id: setupId })
            if (!setup) {
                return null
            }
            const row = await em.findOne(SvtDbSvtTestSetupDefaultConfigEntity, { setup: setupId })
            if (row) {
                em.assign(row, { defaultConfig: configId })
            }
            else {
                em.create(SvtDbSvtTestSetupDefaultConfigEntity, { setup, defaultConfig: configId })
            }
            await em.flush()
            return { setup, defaultConfigId: configId }
        })
    }

    private async defaultConfigIds(setupIds: number[]): Promise<Map<number, number | null>> {
        if (setupIds.length === 0) {
            return new Map()
        }
        const rows = await this.em.find(SvtDbSvtTestSetupDefaultConfigEntity, { setup: { $in: setupIds } })
        return new Map(rows.map((row) => [row.setup.id, row.defaultConfig?.id ?? null]))
    }

}
