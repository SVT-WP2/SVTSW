import {
    EpicSvtTestTypeConfigBodyEntity,
    EpicSvtTestTypeConfigCreateEntity,
    EpicSvtTestTypeConfigEntity,
    EpicSvtTestTypeConfigsGetAllParams,
} from '../../../svt-tests'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaSvtTestTypeConfigs {

    export enum MessageType {
        GetAllSvtTestTypeConfigs = 'GetAllSvtTestTypeConfigs',
        GetAllSvtTestTypeConfigsReply = 'GetAllSvtTestTypeConfigsReply',
        CreateSvtTestTypeConfig = 'CreateSvtTestTypeConfig',
        CreateSvtTestTypeConfigReply = 'CreateSvtTestTypeConfigReply',
        GetSvtTestTypeConfigBody = 'GetSvtTestTypeConfigBody',
        GetSvtTestTypeConfigBodyReply = 'GetSvtTestTypeConfigBodyReply',
    }

    // GET ALL

    export type GetAllSvtTestTypeConfigsData = {
        filter?: EpicSvtTestTypeConfigsGetAllParams
    }

    export class GetAllSvtTestTypeConfigsMessage extends EpicKafkaMessageClass<GetAllSvtTestTypeConfigsData> {

        readonly type = MessageType.GetAllSvtTestTypeConfigs

    }

    export type GetAllSvtTestTypeConfigsReplyMessageData = {
        items: EpicSvtTestTypeConfigEntity[]
    }

    export class GetAllSvtTestTypeConfigsReplyMessage extends EpicKafkaReplyMessageClass<GetAllSvtTestTypeConfigsReplyMessageData> {

        readonly type = MessageType.GetAllSvtTestTypeConfigsReply

    }

    // CREATE

    export type CreateSvtTestTypeConfigMessageData = {
        create: EpicSvtTestTypeConfigCreateEntity
    }

    export class CreateSvtTestTypeConfigMessage extends EpicKafkaMessageClass<CreateSvtTestTypeConfigMessageData> {

        readonly type = MessageType.CreateSvtTestTypeConfig

    }

    export type CreateSvtTestTypeConfigReplyMessageData = {
        entity: EpicSvtTestTypeConfigEntity
    }

    export class CreateSvtTestTypeConfigReplyMessage extends EpicKafkaReplyMessageClass<CreateSvtTestTypeConfigReplyMessageData> {

        readonly type = MessageType.CreateSvtTestTypeConfigReply

    }

    // GET CONFIG BODY

    export type GetSvtTestTypeConfigBodyMessageData = {
        id: number
    }

    export class GetSvtTestTypeConfigBodyMessage extends EpicKafkaMessageClass<GetSvtTestTypeConfigBodyMessageData> {

        readonly type = MessageType.GetSvtTestTypeConfigBody

    }

    export type GetSvtTestTypeConfigBodyReplyMessageData = {
        entity: EpicSvtTestTypeConfigBodyEntity
    }

    export class GetSvtTestTypeConfigBodyReplyMessage extends EpicKafkaReplyMessageClass<GetSvtTestTypeConfigBodyReplyMessageData> {

        readonly type = MessageType.GetSvtTestTypeConfigBodyReply

    }

    export type RequestMessage =
        | GetAllSvtTestTypeConfigsMessage
        | CreateSvtTestTypeConfigMessage
        | GetSvtTestTypeConfigBodyMessage

    export type ReplyMessage =
        | GetAllSvtTestTypeConfigsReplyMessage
        | CreateSvtTestTypeConfigReplyMessage
        | GetSvtTestTypeConfigBodyReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}

