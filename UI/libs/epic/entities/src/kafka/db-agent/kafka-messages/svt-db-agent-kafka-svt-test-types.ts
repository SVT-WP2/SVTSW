import {
    EpicSvtTestTypeCreateEntity,
    EpicSvtTestTypeEntity,
    EpicSvtTestTypesGetAllParams,
    EpicSvtTestTypeUpdateEntity,
} from '../../../svt-tests'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaSvtTestTypes {

    export enum MessageType {
        GetAllSvtTestTypes = 'GetAllSvtTestTypes',
        GetAllSvtTestTypesReply = 'GetAllSvtTestTypesReply',
        CreateSvtTestType = 'CreateSvtTestType',
        CreateSvtTestTypeReply = 'CreateSvtTestTypeReply',
        UpdateSvtTestType = 'UpdateSvtTestType',
        UpdateSvtTestTypeReply = 'UpdateSvtTestTypeReply',
    }

    // GET ALL

    export type GetAllSvtTestTypesData = {
        filter?: EpicSvtTestTypesGetAllParams
    }

    export class GetAllSvtTestTypesMessage extends EpicKafkaMessageClass<GetAllSvtTestTypesData> {

        readonly type = MessageType.GetAllSvtTestTypes

    }

    export type GetAllSvtTestTypesReplyMessageData = {
        items: EpicSvtTestTypeEntity[]
    }

    export class GetAllSvtTestTypesReplyMessage extends EpicKafkaReplyMessageClass<GetAllSvtTestTypesReplyMessageData> {

        readonly type = MessageType.GetAllSvtTestTypesReply

    }

    // CREATE

    export type CreateSvtTestTypeMessageData = {
        create: EpicSvtTestTypeCreateEntity
    }

    export class CreateSvtTestTypeMessage extends EpicKafkaMessageClass<CreateSvtTestTypeMessageData> {

        readonly type = MessageType.CreateSvtTestType

    }

    export type CreateSvtTestTypeReplyMessageData = {
        entity: EpicSvtTestTypeEntity
    }

    export class CreateSvtTestTypeReplyMessage extends EpicKafkaReplyMessageClass<CreateSvtTestTypeReplyMessageData> {

        readonly type = MessageType.CreateSvtTestTypeReply

    }

    // UPDATE

    export type UpdateSvtTestTypeMessageData = {
        id: number
        update: EpicSvtTestTypeUpdateEntity
    }

    export class UpdateSvtTestTypeMessage extends EpicKafkaMessageClass<UpdateSvtTestTypeMessageData> {

        readonly type = MessageType.UpdateSvtTestType

    }

    export type UpdateSvtTestTypeReplyMessageData = {
        entity: EpicSvtTestTypeEntity
    }

    export class UpdateSvtTestTypeReplyMessage extends EpicKafkaReplyMessageClass<UpdateSvtTestTypeReplyMessageData> {

        readonly type = MessageType.UpdateSvtTestTypeReply

    }

    export type RequestMessage =
        | GetAllSvtTestTypesMessage
        | CreateSvtTestTypeMessage
        | UpdateSvtTestTypeMessage

    export type ReplyMessage =
        | GetAllSvtTestTypesReplyMessage
        | CreateSvtTestTypeReplyMessage
        | UpdateSvtTestTypeReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}

