import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { SvtDbWpMachineEntity } from './svt-db-wp-machine.entity'
import { SvtDbWpProbeCardInstalledInMachineEntity } from './svt-db-wp-probe-card-installed-in-machine.entity'
import { SvtDbWpWaferLoadedInMachineEntity } from './svt-db-wp-wafer-loaded-in-machine.entity'


export type SvtDbWpMachinesFilter = {
    ids?: number[]
}

export type SvtDbWpMachineCreateInput = Pick<
    SvtDbWpMachineEntity,
    'name' | 'serialNumber' | 'hostName' | 'connectionType' | 'connectionPort' | 'generalLocation' | 'software' | 'swVersion' | 'vendor'
>

export type SvtDbWpMachineUpdateInput = Partial<Pick<
    SvtDbWpMachineEntity,
    'hostName' | 'connectionType' | 'connectionPort' | 'generalLocation' | 'software' | 'swVersion'
>>

/** `waferId: null` unloads; otherwise the wafer is loaded with the given orientation. */
export type SvtDbWpLoadedWaferChange = {
    waferId: number | null
    orientation: string | null
}

/** `probeCardId: null` uninstalls; otherwise the card is installed with the given (optional) orientation. */
export type SvtDbWpInstalledProbeCardChange = {
    probeCardId: number | null
    orientation: string | null
}

export const SVT_DB_WP_WAFER_LOADED = 'Loaded'
export const SVT_DB_WP_WAFER_UNLOADED = 'Unloaded'

/**
 * Wafer-prober machines with their loaded-wafer and installed-probe-card histories. Every write is one
 * transaction on the request context the dispatcher opens per message.
 */
@Injectable()
export class SvtDbWpMachinesRepository {

    constructor(private readonly em: EntityManager) {
    }

    async findPage(filter: SvtDbWpMachinesFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbWpMachineEntity>> {
        const where = filter.ids?.length ? { id: { $in: filter.ids } } : {}
        const [items, totalCount] = await this.em.findAndCount(SvtDbWpMachineEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
    }

    findById(id: number): Promise<SvtDbWpMachineEntity | null> {
        return this.em.findOne(SvtDbWpMachineEntity, { id })
    }

    create(input: SvtDbWpMachineCreateInput): Promise<SvtDbWpMachineEntity> {
        return this.em.transactional(async (em) => {
            const machine = em.create(SvtDbWpMachineEntity, {
                ...input,
                loadedWafer: null,
                loadedWaferOrientation: null,
                installedProbeCard: null,
                installedProbeCardOrientation: null,
            })
            await em.flush()
            return machine
        })
    }

    /** Updates the given fields; `null` when the machine does not exist. */
    update(id: number, patch: SvtDbWpMachineUpdateInput): Promise<SvtDbWpMachineEntity | null> {
        return this.em.transactional(async (em) => {
            const machine = await em.findOne(SvtDbWpMachineEntity, { id })
            if (!machine) {
                return null
            }
            em.assign(machine, patch)
            await em.flush()
            return machine
        })
    }

    /**
     * Loads a wafer into the machine or unloads the current one, writing the history: a `Loaded` row for the
     * new wafer, or an `Unloaded` row for the current one when `waferId` is `null`. A swap writes only the
     * `Loaded` row, as the C++ did: the author confirmed that a load implies the unload of the previous wafer
     * (X-8, Q13). `null` when the machine does not exist.
     */
    setLoadedWafer(machineId: number, change: SvtDbWpLoadedWaferChange): Promise<SvtDbWpMachineEntity | null> {
        return this.em.transactional(async (em) => {
            const machine = await em.findOne(SvtDbWpMachineEntity, { id: machineId })
            if (!machine) {
                return null
            }
            if (change.waferId !== null) {
                em.create(SvtDbWpWaferLoadedInMachineEntity, {
                    machine,
                    wafer: change.waferId,
                    orientation: change.orientation,
                    status: SVT_DB_WP_WAFER_LOADED,
                })
            }
            else if (machine.loadedWafer) {
                em.create(SvtDbWpWaferLoadedInMachineEntity, {
                    machine,
                    wafer: machine.loadedWafer.id,
                    orientation: null,
                    status: SVT_DB_WP_WAFER_UNLOADED,
                })
            }
            em.assign(machine, { loadedWafer: change.waferId, loadedWaferOrientation: change.orientation })
            await em.flush()
            return machine
        })
    }

    /**
     * Installs a probe card into the machine (one history row) or uninstalls the current one. The history
     * table cannot record an uninstall (`probeCardId` NOT NULL, no status column: D-13), so an uninstall only
     * clears the machine's columns. `null` when the machine does not exist.
     */
    setInstalledProbeCard(machineId: number, change: SvtDbWpInstalledProbeCardChange): Promise<SvtDbWpMachineEntity | null> {
        return this.em.transactional(async (em) => {
            const machine = await em.findOne(SvtDbWpMachineEntity, { id: machineId })
            if (!machine) {
                return null
            }
            if (change.probeCardId !== null) {
                em.create(SvtDbWpProbeCardInstalledInMachineEntity, {
                    machine,
                    probeCard: change.probeCardId,
                    orientation: change.orientation,
                })
            }
            em.assign(machine, { installedProbeCard: change.probeCardId, installedProbeCardOrientation: change.orientation })
            await em.flush()
            return machine
        })
    }

}
