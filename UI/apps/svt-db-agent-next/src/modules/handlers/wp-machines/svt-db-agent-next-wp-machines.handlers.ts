import { Injectable } from '@nestjs/common'
import { EpicWpMachineCreateRequestDto, EpicWpMachineUpdateRequestDto, SvtDbAgentKafka, SvtDbAgentKafkaWpMachines } from 'epic/entities'
import { EpicWpMachine } from 'epic-api-types'
import {
    SvtDbEnumsService,
    SvtDbWafersRepository,
    SvtDbWpMachineEntity,
    SvtDbWpMachinesRepository,
    SvtDbWpProbeCardsRepository,
} from 'svt-db/data'

import {
    optionalIntegerList,
    optionalRecord,
    requireAllowedFilterKeys,
    requireInteger,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'

import { SvtDbAgentNextWpMachineInstalledProbeCardDto, SvtDbAgentNextWpMachineLoadedWaferDto } from './svt-db-agent-next-wp-machines.dtos'


import MessageType = SvtDbAgentKafkaWpMachines.MessageType


/**
 * The machine on the wire: `WaferProbeMachineDto` of the Kafka contract, which carries the two orientations
 * WPAgent reads; the TypeScript `EpicWpMachine` does not list them yet.
 */
export type SvtDbAgentNextWpMachineWire = EpicWpMachine & {
    loadedWaferOrientation: string | null
    installedProbeCardOrientation: string | null
}

type MachineEnums = Partial<Record<'connectionType' | 'generalLocation' | 'software' | 'vendor', string>>

const ENUM_BY_FIELD = {
    connectionType: 'wpConnectionType',
    generalLocation: 'wpGeneralLocation',
    software: 'wpSwType',
    vendor: 'wpVendor',
} as const

/**
 * `GetAllWaferProbeMachines`, `CreateWaferProbeMachine`, `UpdateWaferProbeMachine`, `UpdateWpMachineLoadedWafer`,
 * `UpdateWpMachineInstalledProbeCard` (`DbAgent/docs/05-request-handlers.md` §7; decisions X-8 and D-13 in
 * `docs/db-agent-clone/01-behaviour-decisions.md`). A wafer swap writes one `Loaded` row (the unload is implied,
 * Q13); an uninstall clears the machine's probe-card columns (the history table cannot record it yet).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextWpMachinesHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly machines: SvtDbWpMachinesRepository,
        private readonly probeCards: SvtDbWpProbeCardsRepository,
        private readonly wafers: SvtDbWafersRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllWpMachines, replyType: MessageType.GetAllWpMachinesReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateWpMachine, replyType: MessageType.CreateWpMachineReply, handle: (data) => this.create(data) },
            { type: MessageType.UpdateWpMachine, replyType: MessageType.UpdateWpMachineReply, handle: (data) => this.update(data) },
            {
                type: MessageType.UpdateWpMachineLoadedWafer,
                replyType: MessageType.UpdateWpMachineLoadedWaferReply,
                handle: (data) => this.updateLoadedWafer(data),
            },
            {
                type: MessageType.UpdateWpMachineInstalledProbeCard,
                replyType: MessageType.UpdateWpMachineInstalledProbeCardReply,
                handle: (data) => this.updateInstalledProbeCard(data),
            },
        ]
    }

    /** `data.filter.ids` is the only filter; the contract has no pager for machines. */
    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<SvtDbAgentNextWpMachineWire>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const items = await this.machines.findAll({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') })
        return { items: items.map(toWire), totalCount: items.length }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<SvtDbAgentNextWpMachineWire>> {
        const create = validateRequestData(EpicWpMachineCreateRequestDto, requireRecord(data, 'data')['create'], 'data.create')
        await this.assertEnumValues(create)

        const machine = await this.machines.create({
            name: create.name,
            serialNumber: create.serialNumber,
            hostName: create.hostName,
            connectionType: create.connectionType,
            connectionPort: create.connectionPort,
            generalLocation: create.generalLocation,
            software: create.software,
            swVersion: create.swVersion,
            vendor: create.vendor,
        })
        return { entity: toWire(machine) }
    }

    /** `data.id` + `data.update` (the contract's six updatable fields, all required by its DTO). */
    private async update(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<SvtDbAgentNextWpMachineWire>> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = validateRequestData(EpicWpMachineUpdateRequestDto, body['update'], 'data.update')
        await this.assertEnumValues(update)

        const machine = await this.machines.update(id, {
            hostName: update.hostName,
            connectionType: update.connectionType,
            connectionPort: update.connectionPort,
            generalLocation: update.generalLocation,
            software: update.software,
            swVersion: update.swVersion,
        })
        if (!machine) {
            throw SvtDbAgentNextRequestError.notFound(`Wafer probe machine ${id} not found`)
        }
        return { entity: toWire(machine) }
    }

    /**
     * `data = { wpMachineId, loadedWaferId | null, loadedWaferOrientation | null }`. Loading needs an existing
     * wafer and an orientation; unloading needs a loaded wafer. The history gets a `Loaded` row for the new
     * wafer, or an `Unloaded` row for the current one on an unload; a swap writes no `Unloaded` row (X-8, Q13).
     */
    private async updateLoadedWafer(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<SvtDbAgentNextWpMachineWire>> {
        const record = validateRequestData(SvtDbAgentNextWpMachineLoadedWaferDto, data, 'data')
        const machine = await this.requireMachine(record.wpMachineId)
        const waferId = record.loadedWaferId ?? null
        const orientation = record.loadedWaferOrientation ?? null

        if (waferId === null) {
            if (!machine.loadedWafer) {
                throw SvtDbAgentNextRequestError.badRequest(`No wafer is loaded in wafer probe machine ${machine.id}`)
            }
        }
        else {
            if (orientation === null) {
                throw SvtDbAgentNextRequestError.badRequest('data.loadedWaferOrientation is required to load a wafer')
            }
            await this.assertEnumValue('waferMapOrientation', orientation)
            if (!(await this.wafers.findById(waferId))) {
                throw SvtDbAgentNextRequestError.badRequest(`Wafer ${waferId} does not exist`)
            }
        }

        const updated = await this.machines.setLoadedWafer(machine.id, { waferId, orientation: waferId === null ? null : orientation })
        return { entity: toWire(updated) }
    }

    /**
     * `data = { wpMachineId, installedProbeCardId | null, installedProbeCardOrientation | null }`. Installing
     * needs an existing probe card (the orientation is optional); `null` uninstalls (D-13: no history row).
     */
    private async updateInstalledProbeCard(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<SvtDbAgentNextWpMachineWire>> {
        const record = validateRequestData(SvtDbAgentNextWpMachineInstalledProbeCardDto, data, 'data')
        const machine = await this.requireMachine(record.wpMachineId)
        const probeCardId = record.installedProbeCardId ?? null
        const orientation = record.installedProbeCardOrientation ?? null

        if (probeCardId !== null) {
            if (orientation !== null) {
                await this.assertEnumValue('waferMapOrientation', orientation)
            }
            if (!(await this.probeCards.findById(probeCardId))) {
                throw SvtDbAgentNextRequestError.badRequest(`Probe card ${probeCardId} does not exist`)
            }
        }

        const updated = await this.machines.setInstalledProbeCard(machine.id, {
            probeCardId,
            orientation: probeCardId === null ? null : orientation,
        })
        return { entity: toWire(updated) }
    }

    private async requireMachine(id: number): Promise<SvtDbWpMachineEntity> {
        const machine = await this.machines.findById(id)
        if (!machine) {
            throw SvtDbAgentNextRequestError.notFound(`Wafer probe machine ${id} not found`)
        }
        return machine
    }

    /** Checks every enum-typed field present in `values` against the live catalog. */
    private async assertEnumValues(values: MachineEnums): Promise<void> {
        const fields = (Object.keys(ENUM_BY_FIELD) as (keyof typeof ENUM_BY_FIELD)[]).filter((field) => values[field] !== undefined)
        const enums = await this.enums.getAll(fields.map((field) => ENUM_BY_FIELD[field]))
        for (const field of fields) {
            const enumName = ENUM_BY_FIELD[field]
            if (!enums[enumName]?.includes(values[field])) {
                throw SvtDbAgentNextRequestError.badRequest(`${values[field]} is not a value of the ${enumName} enum`)
            }
        }
    }

    private async assertEnumValue(enumName: 'waferMapOrientation', value: string): Promise<void> {
        const values = await this.enums.getValues(enumName)
        if (!values.includes(value)) {
            throw SvtDbAgentNextRequestError.badRequest(`${value} is not a value of the ${enumName} enum`)
        }
    }

}

function toWire(machine: SvtDbWpMachineEntity): SvtDbAgentNextWpMachineWire {
    return {
        id: machine.id,
        name: machine.name,
        serialNumber: machine.serialNumber,
        hostName: machine.hostName,
        connectionType: machine.connectionType,
        connectionPort: machine.connectionPort,
        generalLocation: machine.generalLocation,
        software: machine.software,
        swVersion: machine.swVersion,
        vendor: machine.vendor,
        loadedWaferId: machine.loadedWafer?.id ?? null,
        loadedWaferOrientation: machine.loadedWaferOrientation,
        installedProbeCardId: machine.installedProbeCard?.id ?? null,
        installedProbeCardOrientation: machine.installedProbeCardOrientation,
    }
}
