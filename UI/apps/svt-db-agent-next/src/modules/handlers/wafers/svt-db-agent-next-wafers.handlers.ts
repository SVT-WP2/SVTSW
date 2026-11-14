import { Injectable } from '@nestjs/common'
import { EpicWafer, EpicWaferLocationHistoryRecord } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWafers } from 'epic-api-types/kafka'

import {
    generateAsics,
    SvtDbEnumsService,
    SvtDbWaferEntity,
    SvtDbWaferLocationEntity,
    SvtDbWaferMap,
    SvtDbWafersRepository,
    SvtDbWaferTypesRepository,
} from '../../../db/data'
import {
    optionalIntegerList,
    optionalPager,
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

import {
    SvtDbAgentNextWaferCreateDto,
    SvtDbAgentNextWaferLocationRecordDto,
    SvtDbAgentNextWaferUpdateDto,
} from './svt-db-agent-next-wafers.dtos'


import MessageType = SvtDbAgentKafkaWafers.MessageType


const LOCATION_UPDATE_NOT_ALLOWED = 'Failed to update entry. update location is not allowed using generic update request'

/**
 * `GetAllWafers`, `CreateWafer`, `UpdateWafer`, `UpdateWaferLocation`, `GetWaferLocationHistory`
 * (`DbAgent/docs/05-request-handlers.md` §1 and §3, decisions in `docs/db-agent-clone/01-behaviour-decisions.md`).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextWafersHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly wafers: SvtDbWafersRepository,
        private readonly waferTypes: SvtDbWaferTypesRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllWafers, replyType: MessageType.GetAllWafersReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateWafer, replyType: MessageType.CreateWaferReply, handle: (data) => this.create(data) },
            { type: MessageType.UpdateWafer, replyType: MessageType.UpdateWaferReply, handle: (data) => this.update(data) },
            {
                type: MessageType.UpdateWaferLocation,
                replyType: MessageType.UpdateWaferLocationReply,
                handle: (data) => this.updateLocation(data),
            },
            {
                type: MessageType.GetWaferLocationHistory,
                replyType: MessageType.GetWaferLocationHistoryReply,
                handle: (data) => this.getLocationHistory(data),
            },
        ]
    }

    /** `data.filter.ids` and `data.pager`, both optional; the page is counted database-side. */
    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicWafer>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const ids = optionalIntegerList(filter['ids'], 'data.filter.ids')
        const pager = optionalPager(body['pager'], 'data.pager')
        const page = await this.wafers.findPage({ ids }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    /**
     * Wafer + first location row + every ASIC of the wafer map, in one transaction. The location is required
     * (the C++ agent failed without one, after writing the wafer); the wafer type must exist and have a map.
     */
    private async create(data: unknown): Promise<SvtDbAgentKafkaWafers.CreateWaferReplyMessageData> {
        const body = requireRecord(data, 'data')
        const create = validateRequestData(SvtDbAgentNextWaferCreateDto, body['create'], 'data.create')
        if (!create.generalLocation) {
            throw SvtDbAgentNextRequestError.badRequest('data.create.generalLocation is required to create a wafer')
        }
        await this.assertGeneralLocation(create.generalLocation)

        const waferType = await this.waferTypes.findById(create.waferTypeId)
        if (!waferType) {
            throw SvtDbAgentNextRequestError.badRequest(`Wafer type ${create.waferTypeId} does not exist`)
        }
        const map = await this.waferTypes.findMap(create.waferTypeId)
        if (!map) {
            throw SvtDbAgentNextRequestError.badRequest(`Wafer type ${create.waferTypeId} has no wafer map`)
        }

        const wafer = await this.wafers.createWithLocationAndAsics(
            {
                waferTypeId: create.waferTypeId,
                serialNumber: create.serialNumber,
                batchNumber: create.batchNumber,
                thinningDate: create.thinningDate ?? null,
                dicingDate: create.dicingDate ?? null,
                productionDate: create.productionDate ?? null,
                generalLocation: create.generalLocation,
            },
            () => generateAsicsOrBadRequest(create.serialNumber, map.waferMap as SvtDbWaferMap),
        )
        return { entity: toWire(wafer) }
    }

    /** `data.id` + `data.update` (the three dates); a location change must go through `UpdateWaferLocation`. */
    private async update(data: unknown): Promise<SvtDbAgentKafkaWafers.UpdateWaferReplyMessageData> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = requireRecord(body['update'], 'data.update')
        if ('generalLocation' in update) {
            throw SvtDbAgentNextRequestError.badRequest(LOCATION_UPDATE_NOT_ALLOWED)
        }
        const patch = validateRequestData(SvtDbAgentNextWaferUpdateDto, update, 'data.update')

        const wafer = await this.wafers.update(id, patch)
        if (!wafer) {
            throw SvtDbAgentNextRequestError.notFound(`Wafer ${id} not found`)
        }
        return { entity: toWire(wafer) }
    }

    /** `data` is the history record; the row written becomes the current location. */
    private async updateLocation(data: unknown): Promise<SvtDbAgentKafkaWafers.UpdateWaferLocationReplyMessageData> {
        const record = validateRequestData(SvtDbAgentNextWaferLocationRecordDto, data, 'data')
        await this.assertGeneralLocation(record.generalLocation)

        const wafer = await this.wafers.appendLocation(record.waferId, {
            generalLocation: record.generalLocation,
            date: record.date ?? null,
            username: record.username ?? null,
            note: record.note ?? null,
        })
        if (!wafer) {
            throw SvtDbAgentNextRequestError.notFound(`Wafer ${record.waferId} not found`)
        }
        return { entity: toWire(wafer) }
    }

    private async getLocationHistory(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicWaferLocationHistoryRecord>> {
        const waferId = requireInteger(requireRecord(data, 'data')['waferId'], 'data.waferId')
        if (!(await this.wafers.findById(waferId))) {
            throw SvtDbAgentNextRequestError.notFound(`Wafer ${waferId} not found`)
        }
        const history = await this.wafers.findLocationHistory(waferId)
        return { items: history.map(toWireLocation), totalCount: history.length }
    }

    private async assertGeneralLocation(value: string): Promise<void> {
        const values = await this.enums.getValues('wpGeneralLocation')
        if (!values.includes(value)) {
            throw SvtDbAgentNextRequestError.badRequest(`${value} is not a value of the wpGeneralLocation enum`)
        }
    }

}

function generateAsicsOrBadRequest(serialNumber: string, map: SvtDbWaferMap) {
    try {
        return generateAsics(serialNumber, map)
    }
    catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        throw SvtDbAgentNextRequestError.badRequest(`Cannot generate the ASICs of the wafer: ${reason}`)
    }
}

function toWire(wafer: SvtDbWaferEntity): EpicWafer {
    return {
        id: wafer.id,
        serialNumber: wafer.serialNumber,
        batchNumber: wafer.batchNumber,
        thinningDate: wafer.thinningDate,
        dicingDate: wafer.dicingDate,
        productionDate: wafer.productionDate,
        waferTypeId: wafer.waferType.id,
        generalLocation: wafer.generalLocation,
    }
}

function toWireLocation(row: SvtDbWaferLocationEntity): EpicWaferLocationHistoryRecord {
    return {
        waferId: row.wafer.id,
        generalLocation: row.generalLocation,
        date: row.date,
        note: row.note ?? '',
        username: row.username,
    }
}
