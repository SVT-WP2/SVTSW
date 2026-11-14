import { Injectable } from '@nestjs/common'
import { EpicAsicCreateRequestDto } from 'epic/entities'
import { EpicAsic } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaAsics } from 'epic-api-types/kafka'
import { SvtDbAsicsRepository, SvtDbAsicWithChip, SvtDbEnumsService, SvtDbWafersRepository } from 'svt-db/data'

import {
    optionalInteger,
    optionalIntegerList,
    optionalPager,
    optionalRecord,
    optionalString,
    optionalStringList,
    requireAllowedFilterKeys,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'


import MessageType = SvtDbAgentKafkaAsics.MessageType


const FILTER_KEYS = ['ids', 'waferId', 'chipId', 'familyTypes', 'quality', 'serialNumber'] as const

/**
 * `GetAllAsics` and `CreateAsic` (`DbAgent/docs/05-request-handlers.md` §4). Items carry `chipId`, the id of
 * the chip diced from the ASIC or `null`; the `chipId` filter works (Q-H4 fixed) and `serialNumber` is a
 * case-insensitive substring search, as the contract describes it.
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextAsicsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly asics: SvtDbAsicsRepository,
        private readonly wafers: SvtDbWafersRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllAsics, replyType: MessageType.GetAllAsicsReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateAsic, replyType: MessageType.CreateAsicReply, handle: (data) => this.create(data) },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicAsic>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, FILTER_KEYS)
        const pager = optionalPager(body['pager'], 'data.pager')

        const page = await this.asics.findPage({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            waferId: optionalInteger(filter['waferId'], 'data.filter.waferId'),
            chipId: optionalInteger(filter['chipId'], 'data.filter.chipId'),
            familyTypes: optionalStringList(filter['familyTypes'], 'data.filter.familyTypes'),
            quality: optionalString(filter['quality'], 'data.filter.quality'),
            serialNumber: optionalString(filter['serialNumber'], 'data.filter.serialNumber'),
        }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    /** A manually registered ASIC (the UI does not use it); enum values and the wafer are checked first. */
    private async create(data: unknown): Promise<SvtDbAgentKafkaAsics.CreateAsicReplyMessageData> {
        const body = requireRecord(data, 'data')
        const create = validateRequestData(EpicAsicCreateRequestDto, body['create'], 'data.create')

        const enums = await this.enums.getAll(['asicFamilyType', 'asicQuality'])
        if (!enums['asicFamilyType']?.includes(create.familyType)) {
            throw SvtDbAgentNextRequestError.badRequest(`${create.familyType} is not a value of the asicFamilyType enum`)
        }
        if (!enums['asicQuality']?.includes(create.quality)) {
            throw SvtDbAgentNextRequestError.badRequest(`${create.quality} is not a value of the asicQuality enum`)
        }
        if (!(await this.wafers.findById(create.waferId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Wafer ${create.waferId} does not exist`)
        }

        const created = await this.asics.create({
            waferId: create.waferId,
            serialNumber: create.serialNumber,
            familyType: create.familyType,
            waferMapPosition: create.waferMapPosition,
            quality: create.quality,
        })
        return { entity: toWire(created) }
    }

}

function toWire({ asic, chipId }: SvtDbAsicWithChip): EpicAsic {
    return {
        id: asic.id,
        serialNumber: asic.serialNumber,
        waferId: asic.wafer.id,
        chipId,
        familyType: asic.familyType,
        waferMapPosition: asic.waferMapPosition,
        quality: asic.quality,
    }
}
