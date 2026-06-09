import { EpicSvtTestSetupConfigBodyEntity, EpicSvtTestSetupConfigCreateEntity, EpicSvtTestSetupConfigEntity } from '../../../svt-tests'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaSvtTestSetupConfigs {

    export enum MessageType {
        GetAllSvtTestSetupConfigs = 'GetAllSvtTestSetupConfigs',
        GetAllSvtTestSetupConfigsReply = 'GetAllSvtTestSetupConfigsReply',
        CreateSvtTestSetupConfig = 'CreateSvtTestSetupConfig',
        CreateSvtTestSetupConfigReply = 'CreateSvtTestSetupConfigReply',
        GetSvtTestSetupConfigBody = 'GetSvtTestSetupConfigBody',
        GetSvtTestSetupConfigBodyReply = 'GetSvtTestSetupConfigBodyReply',
    }

    // GET ALL

    export type GetAllSvtTestSetupConfigsData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllSvtTestSetupConfigsMessage extends EpicKafkaMessageClass<GetAllSvtTestSetupConfigsData> {

        readonly type = MessageType.GetAllSvtTestSetupConfigs

    }

    export type GetAllSvtTestSetupConfigsReplyMessageData = {
        items: EpicSvtTestSetupConfigEntity[]
    }

    export class GetAllSvtTestSetupConfigsReplyMessage extends EpicKafkaReplyMessageClass<GetAllSvtTestSetupConfigsReplyMessageData> {

        readonly type = MessageType.GetAllSvtTestSetupConfigsReply

    }

    // CREATE

    export type CreateSvtTestSetupConfigMessageData = {
        create: EpicSvtTestSetupConfigCreateEntity
    }

    export class CreateSvtTestSetupConfigMessage extends EpicKafkaMessageClass<CreateSvtTestSetupConfigMessageData> {

        readonly type = MessageType.CreateSvtTestSetupConfig

    }

    export type CreateSvtTestSetupConfigReplyMessageData = {
        entity: EpicSvtTestSetupConfigEntity
    }

    export class CreateSvtTestSetupConfigReplyMessage extends EpicKafkaReplyMessageClass<CreateSvtTestSetupConfigReplyMessageData> {

        readonly type = MessageType.CreateSvtTestSetupConfigReply

    }

    // GET CONFIG BODY

    export type GetSvtTestSetupConfigBodyMessageData = {
        id: number
    }

    export class GetSvtTestSetupConfigBodyMessage extends EpicKafkaMessageClass<GetSvtTestSetupConfigBodyMessageData> {

        readonly type = MessageType.GetSvtTestSetupConfigBody

    }

    export type GetSvtTestSetupConfigBodyReplyMessageData = {
        entity: EpicSvtTestSetupConfigBodyEntity
    }

    export class GetSvtTestSetupConfigBodyReplyMessage extends EpicKafkaReplyMessageClass<GetSvtTestSetupConfigBodyReplyMessageData> {

        readonly type = MessageType.GetSvtTestSetupConfigBodyReply

    }

    export type RequestMessage =
        | GetAllSvtTestSetupConfigsMessage
        | CreateSvtTestSetupConfigMessage
        | GetSvtTestSetupConfigBodyMessage

    export type ReplyMessage =
        | GetAllSvtTestSetupConfigsReplyMessage
        | CreateSvtTestSetupConfigReplyMessage
        | GetSvtTestSetupConfigBodyReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
