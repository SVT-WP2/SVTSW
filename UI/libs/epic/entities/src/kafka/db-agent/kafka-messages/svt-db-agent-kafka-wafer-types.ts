import { EpicWaferTypeCreateEntity, EpicWaferTypeEntity, EpicWaferTypeMapEntity } from '../../../wafer-types'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaWaferTypes {

    export enum MessageType {
        GetAllWaferTypes = 'GetAllWaferTypes',
        GetAllWaferTypesReply = 'GetAllWaferTypesReply',
        CreateWaferType = 'CreateWaferType',
        CreateWaferTypeReply = 'CreateWaferTypeReply',
        GetWaferTypeMap = 'GetWaferTypeMap',
        GetWaferTypeMapReply = 'GetWaferTypeMapReply',
    }


    // GET ALL
    export class GetAllWaferTypesMessage extends EpicKafkaMessageClass {

        readonly type = MessageType.GetAllWaferTypes

        constructor() {
            super({})
        }

    }

    export class GetAllWaferTypesReplyMessage
        extends EpicKafkaReplyMessageClass<SvtDbAgentKafka.ListReplyMessageData<EpicWaferTypeEntity>> {

        readonly type = MessageType.GetAllWaferTypesReply

    }

    // CREATE

    export type CreateWaferTypeMessageData = {
        create: EpicWaferTypeCreateEntity
    }

    export class CreateWaferTypeMessage extends EpicKafkaMessageClass<CreateWaferTypeMessageData> {

        readonly type = MessageType.CreateWaferType

    }

    export type CreateWaferTypeReplyMessageData = {
        entity: EpicWaferTypeEntity
    }

    export class CreateWaferTypeReplyMessage extends EpicKafkaReplyMessageClass<CreateWaferTypeReplyMessageData> {

        readonly type = MessageType.CreateWaferTypeReply

    }

    // WAFER MAP

    export type GetWaferTypeMapMessageData = {
        waferTypeId: number
    }

    export class GetWaferTypeMapMessage extends EpicKafkaReplyMessageClass<GetWaferTypeMapMessageData> {

        readonly type = MessageType.GetWaferTypeMap

    }

    export type GetWaferTypeMapMessageReplyData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWaferTypeMapEntity>

    export class GetWaferTypeMapReplyMessage extends EpicKafkaReplyMessageClass<GetWaferTypeMapMessageReplyData> {

        readonly type = MessageType.GetWaferTypeMapReply

    }

    export type RequestMessage =
        | GetAllWaferTypesMessage
        | CreateWaferTypeMessage
        | GetWaferTypeMapMessage

    export type ReplyMessage =
        | GetAllWaferTypesReplyMessage
        | CreateWaferTypeReplyMessage
        | GetWaferTypeMapReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage
}
