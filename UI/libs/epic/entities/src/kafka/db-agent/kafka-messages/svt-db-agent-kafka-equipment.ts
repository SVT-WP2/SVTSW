import { EpicEquipmentCreateEntity, EpicEquipmentEntity, EpicEquipmentLocationHistoryRecordEntity } from '../../../equipment'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaEquipment {

    export enum MessageType {
        GetAllEquipment = 'GetAllEquipment',
        GetAllEquipmentReply = 'GetAllEquipmentReply',
        CreateEquipment = 'CreateEquipment',
        CreateEquipmentReply = 'CreateEquipmentReply',
        UpdateEquipmentLocation = 'UpdateEquipmentLocation',
        UpdateEquipmentLocationReply = 'UpdateEquipmentLocationReply',
        GetEquipmentLocationHistory = 'GetEquipmentLocationHistory',
        GetEquipmentLocationHistoryReply = 'GetEquipmentLocationHistoryReply',
    }


    // GET ALL

    export type GetAllEquipmentMessageData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllEquipmentMessage extends EpicKafkaMessageClass<GetAllEquipmentMessageData> {

        readonly type = MessageType.GetAllEquipment

    }

    export class GetAllEquipmentReplyMessage
        extends EpicKafkaReplyMessageClass<SvtDbAgentKafka.ListReplyMessageData<EpicEquipmentEntity>> {

        readonly type = MessageType.GetAllEquipmentReply

    }

    // CREATE

    export type CreateEquipmentMessageData = {
        create: EpicEquipmentCreateEntity
    }

    export class CreateEquipmentMessage extends EpicKafkaMessageClass<CreateEquipmentMessageData> {

        readonly type = MessageType.CreateEquipment

    }

    export type CreateEquipmentReplyMessageData = {
        entity: EpicEquipmentEntity
    }

    export class CreateEquipmentReplyMessage extends EpicKafkaReplyMessageClass<CreateEquipmentReplyMessageData> {

        readonly type = MessageType.CreateEquipmentReply

    }


    // LOCATION

    export class UpdateEquipmentLocationMessage extends EpicKafkaMessageClass<EpicEquipmentLocationHistoryRecordEntity> {

        readonly type = MessageType.UpdateEquipmentLocation

    }

    export type UpdateEquipmentLocationReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicEquipmentEntity>

    export class UpdateEquipmentLocationReplyMessage extends EpicKafkaReplyMessageClass<UpdateEquipmentLocationReplyMessageData> {

        readonly type = MessageType.UpdateEquipmentLocationReply

    }

    export type GetEquipmentLocationHistoryMessageData = {
        equipmentId: number
    }

    export class GetEquipmentLocationHistoryMessage extends EpicKafkaMessageClass<GetEquipmentLocationHistoryMessageData> {

        readonly type = MessageType.GetEquipmentLocationHistory

    }

    export type GetEquipmentLocationHistoryReplyMessageData = SvtDbAgentKafka.ListReplyMessageData<EpicEquipmentLocationHistoryRecordEntity>

    export class GetEquipmentLocationHistoryReplyMessage extends EpicKafkaReplyMessageClass<GetEquipmentLocationHistoryReplyMessageData> {

        readonly type = MessageType.GetEquipmentLocationHistoryReply

    }


    export type RequestMessage =
        | GetAllEquipmentMessage
        | CreateEquipmentMessage
        | UpdateEquipmentLocationMessage
        | GetEquipmentLocationHistoryMessage

    export type ReplyMessage =
        | GetAllEquipmentReplyMessage
        | CreateEquipmentReplyMessage
        | UpdateEquipmentLocationReplyMessage
        | GetEquipmentLocationHistoryReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage
}
