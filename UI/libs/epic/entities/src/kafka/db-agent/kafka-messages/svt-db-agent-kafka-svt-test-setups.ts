import { EpicSvtTestSetupCreateEntity, EpicSvtTestSetupEntity, EpicSvtTestSetupUpdateEntity } from '../../../svt-tests'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaSvtTestSetups {

    export enum MessageType {
        GetAllSvtTestSetups = 'GetAllSvtTestSetups',
        GetAllSvtTestSetupsReply = 'GetAllSvtTestSetupsReply',
        CreateSvtTestSetup = 'CreateSvtTestSetup',
        CreateSvtTestSetupReply = 'CreateSvtTestSetupReply',
        UpdateSvtTestSetup = 'UpdateSvtTestSetup',
        UpdateSvtTestSetupReply = 'UpdateSvtTestSetupReply',
    }

    // GET ALL

    export type GetAllSvtTestSetupsData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllSvtTestSetupsMessage extends EpicKafkaMessageClass<GetAllSvtTestSetupsData> {

        readonly type = MessageType.GetAllSvtTestSetups

    }

    export type GetAllSvtTestSetupsReplyMessageData = {
        items: EpicSvtTestSetupEntity[]
    }

    export class GetAllSvtTestSetupsReplyMessage extends EpicKafkaReplyMessageClass<GetAllSvtTestSetupsReplyMessageData> {

        readonly type = MessageType.GetAllSvtTestSetupsReply

    }

    // CREATE

    export type CreateSvtTestSetupMessageData = {
        create: EpicSvtTestSetupCreateEntity
    }

    export class CreateSvtTestSetupMessage extends EpicKafkaMessageClass<CreateSvtTestSetupMessageData> {

        readonly type = MessageType.CreateSvtTestSetup

    }

    export type CreateSvtTestSetupReplyMessageData = {
        entity: EpicSvtTestSetupEntity
    }

    export class CreateSvtTestSetupReplyMessage extends EpicKafkaReplyMessageClass<CreateSvtTestSetupReplyMessageData> {

        readonly type = MessageType.CreateSvtTestSetupReply

    }

    // UPDATE

    export type UpdateSvtTestSetupMessageData = {
        id: number
        update: EpicSvtTestSetupUpdateEntity
    }

    export class UpdateSvtTestSetupMessage extends EpicKafkaMessageClass<UpdateSvtTestSetupMessageData> {

        readonly type = MessageType.UpdateSvtTestSetup

    }

    export type UpdateSvtTestSetupReplyMessageData = {
        entity: EpicSvtTestSetupEntity
    }

    export class UpdateSvtTestSetupReplyMessage extends EpicKafkaReplyMessageClass<UpdateSvtTestSetupReplyMessageData> {

        readonly type = MessageType.UpdateSvtTestSetupReply

    }

    export type RequestMessage =
        | GetAllSvtTestSetupsMessage
        | CreateSvtTestSetupMessage
        | UpdateSvtTestSetupMessage

    export type ReplyMessage =
        | GetAllSvtTestSetupsReplyMessage
        | CreateSvtTestSetupReplyMessage
        | UpdateSvtTestSetupReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
