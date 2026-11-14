import { EpicEquipmentType, EpicEquipmentTypeCreateRequest } from 'epic-api-types'

import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaEquipmentTypes {

    export enum MessageType {
        GetAllEquipmentTypes = 'GetAllEquipmentTypes',
        GetAllEquipmentTypesReply = 'GetAllEquipmentTypesReply',
        CreateEquipmentType = 'CreateEquipmentType',
        CreateEquipmentTypeReply = 'CreateEquipmentTypeReply',
    }


    // GET ALL

    export type GetAllEquipmentTypesMessageData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllEquipmentTypesMessage extends EpicKafkaMessageClass<GetAllEquipmentTypesMessageData> {

        readonly type = MessageType.GetAllEquipmentTypes

    }

    export class GetAllEquipmentTypesReplyMessage
        extends EpicKafkaReplyMessageClass<SvtDbAgentKafka.ListReplyMessageData<EpicEquipmentType>> {

        readonly type = MessageType.GetAllEquipmentTypesReply

    }

    // CREATE

    export type CreateEquipmentTypeMessageData = {
        create: EpicEquipmentTypeCreateRequest
    }

    export class CreateEquipmentTypeMessage extends EpicKafkaMessageClass<CreateEquipmentTypeMessageData> {

        readonly type = MessageType.CreateEquipmentType

    }

    export type CreateEquipmentTypeReplyMessageData = {
        entity: EpicEquipmentType
    }

    export class CreateEquipmentTypeReplyMessage extends EpicKafkaReplyMessageClass<CreateEquipmentTypeReplyMessageData> {

        readonly type = MessageType.CreateEquipmentTypeReply

    }


    export type RequestMessage =
        | GetAllEquipmentTypesMessage
        | CreateEquipmentTypeMessage

    export type ReplyMessage =
        | GetAllEquipmentTypesReplyMessage
        | CreateEquipmentTypeReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage
}
