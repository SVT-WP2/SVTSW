import { Injectable } from '@nestjs/common'
import { EpicEquipment, EpicEquipmentLocationHistoryRecord } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaEquipment } from 'svt-ts-types/kafka'

import {
    SvtDbEnumsService,
    SvtDbEquipmentEntity,
    SvtDbEquipmentLocationEntity,
    SvtDbEquipmentRepository,
    SvtDbEquipmentTypesRepository,
} from '../../../db/data'
import {
    optionalIntegerList,
    optionalPager,
    jsonTextOrBadRequest,
    optionalRecord,
    requireAllowedFilterKeys,
    requireInteger,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestContext,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'

import { SvtDbAgentNextEquipmentCreateDto, SvtDbAgentNextEquipmentLocationRecordDto } from './svt-db-agent-next-equipment.dtos'


import MessageType = SvtDbAgentKafkaEquipment.MessageType


/**
 * `GetAllEquipment`, `CreateEquipment`, `UpdateEquipmentLocation`, `GetEquipmentLocationHistory`
 * (`docs/messages.md` §2.8 and §3.10). `specification` travels as a JSON string or `null`
 * (R-7): a string must hold valid JSON, an object is a `BadRequest`; the reply re-serialises the stored JSON.
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextEquipmentHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly equipment: SvtDbEquipmentRepository,
        private readonly equipmentTypes: SvtDbEquipmentTypesRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllEquipment, replyType: MessageType.GetAllEquipmentReply, handle: (data) => this.getAll(data) },
            {
                type: MessageType.CreateEquipment,
                replyType: MessageType.CreateEquipmentReply,
                handle: (data, context) => this.create(data, context),
            },
            {
                type: MessageType.UpdateEquipmentLocation,
                replyType: MessageType.UpdateEquipmentLocationReply,
                handle: (data, context) => this.updateLocation(data, context),
            },
            {
                type: MessageType.GetEquipmentLocationHistory,
                replyType: MessageType.GetEquipmentLocationHistoryReply,
                handle: (data) => this.getLocationHistory(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicEquipment>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const pager = optionalPager(body['pager'], 'data.pager')
        const page = await this.equipment.findPage({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    /** `data.create`: the equipment and its first location row, in one transaction; the row records the user of the request. */
    private async create(
        data: unknown,
        context: SvtDbAgentNextRequestContext,
    ): Promise<SvtDbAgentKafkaEquipment.CreateEquipmentReplyMessageData> {
        const create = validateRequestData(SvtDbAgentNextEquipmentCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        await this.assertGeneralLocation(create.generalLocation)
        if (!(await this.equipmentTypes.findById(create.equipmentTypeId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Equipment type ${create.equipmentTypeId} does not exist`)
        }

        const equipment = await this.equipment.createWithLocation({
            name: create.name,
            equipmentTypeId: create.equipmentTypeId,
            generalLocation: create.generalLocation,
            specification: create.specification === null || create.specification === undefined
                ? null
                : jsonTextOrBadRequest(create.specification, 'data.create.specification'),
            userId: context.userId,
        })
        return { entity: toWire(equipment) }
    }

    /** `data` is the move; the row written becomes the current location and records the user of the request. */
    private async updateLocation(
        data: unknown,
        context: SvtDbAgentNextRequestContext,
    ): Promise<SvtDbAgentKafkaEquipment.UpdateEquipmentLocationReplyMessageData> {
        const record = validateRequestData(SvtDbAgentNextEquipmentLocationRecordDto, data, 'data')
        await this.assertGeneralLocation(record.generalLocation)

        const equipment = await this.equipment.appendLocation(record.equipmentId, {
            generalLocation: record.generalLocation,
            date: record.date ?? null,
            username: record.username ?? null,
            note: record.note ?? null,
            userId: context.userId,
        })
        if (!equipment) {
            throw SvtDbAgentNextRequestError.notFound(`Equipment ${record.equipmentId} not found`)
        }
        return { entity: toWire(equipment) }
    }

    private async getLocationHistory(
        data: unknown,
    ): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicEquipmentLocationHistoryRecord>> {
        const equipmentId = requireInteger(requireRecord(data, 'data')['equipmentId'], 'data.equipmentId')
        if (!(await this.equipment.findById(equipmentId))) {
            throw SvtDbAgentNextRequestError.notFound(`Equipment ${equipmentId} not found`)
        }
        const history = await this.equipment.findLocationHistory(equipmentId)
        return { items: history.map(toWireLocation), totalCount: history.length }
    }

    private async assertGeneralLocation(value: string): Promise<void> {
        const values = await this.enums.getValues('wpGeneralLocation')
        if (!values.includes(value)) {
            throw SvtDbAgentNextRequestError.badRequest(`${value} is not a value of the wpGeneralLocation enum`)
        }
    }

}

function toWire(equipment: SvtDbEquipmentEntity): EpicEquipment {
    return {
        id: equipment.id,
        name: equipment.name,
        equipmentTypeId: equipment.equipmentType.id,
        generalLocation: equipment.generalLocation,
        specification: equipment.specification,
    }
}

function toWireLocation(row: SvtDbEquipmentLocationEntity): EpicEquipmentLocationHistoryRecord {
    return {
        equipmentId: row.equipment.id,
        generalLocation: row.generalLocation,
        date: row.date,
        note: row.note ?? '',
        username: row.username,
        userId: row.user?.id ?? null,
        userName: row.user?.getEntity().name ?? null,
    }
}
