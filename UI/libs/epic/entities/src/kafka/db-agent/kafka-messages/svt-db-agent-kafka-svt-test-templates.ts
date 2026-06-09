import {
    EpicSvtTestTemplateCreateEntity,
    EpicSvtTestTemplateEntity,
    EpicSvtTestTemplatesGetAllParams,
    EpicSvtTestTemplateUpdateEntity,
} from '../../../svt-tests'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaSvtTestTemplates {

    export enum MessageType {
        GetAllSvtTestTemplates = 'GetAllSvtTestTemplates',
        GetAllSvtTestTemplatesReply = 'GetAllSvtTestTemplatesReply',
        CreateSvtTestTemplate = 'CreateSvtTestTemplate',
        CreateSvtTestTemplateReply = 'CreateSvtTestTemplateReply',
        UpdateSvtTestTemplate = 'UpdateSvtTestTemplate',
        UpdateSvtTestTemplateReply = 'UpdateSvtTestTemplateReply',
    }

    // GET ALL

    export type GetAllSvtTestTemplatesData = {
        filter?: EpicSvtTestTemplatesGetAllParams
    }

    export class GetAllSvtTestTemplatesMessage extends EpicKafkaMessageClass<GetAllSvtTestTemplatesData> {

        readonly type = MessageType.GetAllSvtTestTemplates

    }

    export type GetAllSvtTestTemplatesReplyMessageData = {
        items: EpicSvtTestTemplateEntity[]
    }

    export class GetAllSvtTestTemplatesReplyMessage extends EpicKafkaReplyMessageClass<GetAllSvtTestTemplatesReplyMessageData> {

        readonly type = MessageType.GetAllSvtTestTemplatesReply

    }

    // CREATE

    export type CreateSvtTestTemplateMessageData = {
        create: EpicSvtTestTemplateCreateEntity
    }

    export class CreateSvtTestTemplateMessage extends EpicKafkaMessageClass<CreateSvtTestTemplateMessageData> {

        readonly type = MessageType.CreateSvtTestTemplate

    }

    export type CreateSvtTestTemplateReplyMessageData = {
        entity: EpicSvtTestTemplateEntity
    }

    export class CreateSvtTestTemplateReplyMessage extends EpicKafkaReplyMessageClass<CreateSvtTestTemplateReplyMessageData> {

        readonly type = MessageType.CreateSvtTestTemplateReply

    }

    // UPDATE

    export type UpdateSvtTestTemplateMessageData = {
        id: number
        update: EpicSvtTestTemplateUpdateEntity
    }

    export class UpdateSvtTestTemplateMessage extends EpicKafkaMessageClass<UpdateSvtTestTemplateMessageData> {

        readonly type = MessageType.UpdateSvtTestTemplate

    }

    export type UpdateSvtTestTemplateReplyMessageData = {
        entity: EpicSvtTestTemplateEntity
    }

    export class UpdateSvtTestTemplateReplyMessage extends EpicKafkaReplyMessageClass<UpdateSvtTestTemplateReplyMessageData> {

        readonly type = MessageType.UpdateSvtTestTemplateReply

    }

    export type RequestMessage =
        | GetAllSvtTestTemplatesMessage
        | CreateSvtTestTemplateMessage
        | UpdateSvtTestTemplateMessage

    export type ReplyMessage =
        | GetAllSvtTestTemplatesReplyMessage
        | CreateSvtTestTemplateReplyMessage
        | UpdateSvtTestTemplateReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}

