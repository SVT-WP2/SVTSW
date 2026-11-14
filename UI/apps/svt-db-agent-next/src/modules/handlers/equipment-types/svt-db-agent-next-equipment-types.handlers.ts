import { Injectable } from '@nestjs/common'
import { EpicEquipmentType } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaEquipmentTypes } from 'epic-api-types/kafka'

import { SvtDbEquipmentTypeEntity, SvtDbEquipmentTypesRepository } from '../../../db/data'
import {
    optionalIntegerList,
    optionalRecord,
    requireAllowedFilterKeys,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    validateRequestData,
} from '../../dispatch'

import { SvtDbAgentNextEquipmentTypeCreateDto } from './svt-db-agent-next-equipment-types.dtos'


import MessageType = SvtDbAgentKafkaEquipmentTypes.MessageType


/** `GetAllEquipmentTypes` and `CreateEquipmentType` (`DbAgent/docs/05-request-handlers.md` §10). */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextEquipmentTypesHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(private readonly equipmentTypes: SvtDbEquipmentTypesRepository) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            {
                type: MessageType.GetAllEquipmentTypes,
                replyType: MessageType.GetAllEquipmentTypesReply,
                handle: (data) => this.getAll(data),
            },
            {
                type: MessageType.CreateEquipmentType,
                replyType: MessageType.CreateEquipmentTypeReply,
                handle: (data) => this.create(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicEquipmentType>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const items = await this.equipmentTypes.findAll({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') })
        return { items: items.map(toWire), totalCount: items.length }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafkaEquipmentTypes.CreateEquipmentTypeReplyMessageData> {
        const create = validateRequestData(SvtDbAgentNextEquipmentTypeCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        const equipmentType = await this.equipmentTypes.create(create.name)
        return { entity: toWire(equipmentType) }
    }

}

function toWire(equipmentType: SvtDbEquipmentTypeEntity): EpicEquipmentType {
    return { id: equipmentType.id, name: equipmentType.name }
}
