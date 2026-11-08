import { Injectable } from '@nestjs/common'
import { EpicEquipmentEntity, EpicEquipmentLocationHistoryRecordEntity, SvtDbAgentKafka, SvtDbAgentKafkaEquipment } from 'epic/entities'
import {
    SvtDbEnumsService,
    SvtDbEquipmentEntity,
    SvtDbEquipmentLocationEntity,
    SvtDbEquipmentRepository,
    SvtDbEquipmentTypesRepository,
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

import { SvtDbAgentNextEquipmentCreateDto, SvtDbAgentNextEquipmentLocationRecordDto } from './svt-db-agent-next-equipment.dtos'


import MessageType = SvtDbAgentKafkaEquipment.MessageType


/**
 * `GetAllEquipment`, `CreateEquipment`, `UpdateEquipmentLocation`, `GetEquipmentLocationHistory`
 * (`DbAgent/docs/05-request-handlers.md` §1 and §10). `specification` travels as a JSON string or `null`
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
            { type: MessageType.CreateEquipment, replyType: MessageType.CreateEquipmentReply, handle: (data) => this.create(data) },
            {
                type: MessageType.UpdateEquipmentLocation,
                replyType: MessageType.UpdateEquipmentLocationReply,
                handle: (data) => this.updateLocation(data),
            },
            {
                type: MessageType.GetEquipmentLocationHistory,
                replyType: MessageType.GetEquipmentLocationHistoryReply,
                handle: (data) => this.getLocationHistory(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicEquipmentEntity>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const items = await this.equipment.findAll({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') })
        return { items: items.map(toWire), totalCount: items.length }
    }

    /** `data.create`: the equipment and its first location row, in one transaction. */
    private async create(data: unknown): Promise<SvtDbAgentKafkaEquipment.CreateEquipmentReplyMessageData> {
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
                : parseJsonOrBadRequest(create.specification, 'data.create.specification'),
        })
        return { entity: toWire(equipment) }
    }

    /** `data` is the history record; the row written becomes the current location. */
    private async updateLocation(data: unknown): Promise<SvtDbAgentKafkaEquipment.UpdateEquipmentLocationReplyMessageData> {
        const record = validateRequestData(SvtDbAgentNextEquipmentLocationRecordDto, data, 'data')
        await this.assertGeneralLocation(record.generalLocation)

        const equipment = await this.equipment.appendLocation(record.equipmentId, {
            generalLocation: record.generalLocation,
            date: record.date ?? null,
            username: record.username ?? null,
            note: record.note ?? null,
        })
        if (!equipment) {
            throw SvtDbAgentNextRequestError.notFound(`Equipment ${record.equipmentId} not found`)
        }
        return { entity: toWire(equipment) }
    }

    private async getLocationHistory(
        data: unknown,
    ): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicEquipmentLocationHistoryRecordEntity>> {
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

function parseJsonOrBadRequest(text: string, path: string): unknown {
    try {
        return JSON.parse(text)
    }
    catch {
        throw SvtDbAgentNextRequestError.badRequest(`${path} must be a string holding valid JSON`)
    }
}

function toWire(equipment: SvtDbEquipmentEntity): EpicEquipmentEntity {
    return {
        id: equipment.id,
        name: equipment.name,
        equipmentTypeId: equipment.equipmentType.id,
        generalLocation: equipment.generalLocation,
        specification: equipment.specification === null ? null : JSON.stringify(equipment.specification),
    }
}

function toWireLocation(row: SvtDbEquipmentLocationEntity): EpicEquipmentLocationHistoryRecordEntity {
    return {
        equipmentId: row.equipment.id,
        generalLocation: row.generalLocation,
        date: row.date,
        note: row.note ?? '',
        username: row.username,
    }
}
