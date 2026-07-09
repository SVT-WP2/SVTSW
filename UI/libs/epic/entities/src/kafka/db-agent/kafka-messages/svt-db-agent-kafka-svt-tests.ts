import { EpicSvtTestCreateEntity, EpicSvtTestEntity, EpicSvtTestsGetAllParams } from '../../../svt-tests'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaSvtTests {

    export enum MessageType {
        GetAllSvtTests = 'GetAllSvtTests',
        GetAllSvtTestsReply = 'GetAllSvtTestsReply',
        CreateSvtTest = 'CreateSvtTest',
        CreateSvtTestReply = 'CreateSvtTestReply',
    }

    // GET ALL

    export type GetAllSvtTestsData = {
        filter?: EpicSvtTestsGetAllParams
    }

    export class GetAllSvtTestsMessage extends EpicKafkaMessageClass<GetAllSvtTestsData> {

        readonly type = MessageType.GetAllSvtTests

    }

    export type GetAllSvtTestsReplyMessageData = {
        items: EpicSvtTestEntity[]
    }

    export class GetAllSvtTestsReplyMessage extends EpicKafkaReplyMessageClass<GetAllSvtTestsReplyMessageData> {

        readonly type = MessageType.GetAllSvtTestsReply

    }

    // CREATE

    export type CreateSvtTestMessageData = {
        create: EpicSvtTestCreateEntity
    }

    export class CreateSvtTestMessage extends EpicKafkaMessageClass<CreateSvtTestMessageData> {

        readonly type = MessageType.CreateSvtTest

    }

    export type CreateSvtTestReplyMessageData = {
        entity: EpicSvtTestEntity
    }

    export class CreateSvtTestReplyMessage extends EpicKafkaReplyMessageClass<CreateSvtTestReplyMessageData> {

        readonly type = MessageType.CreateSvtTestReply

    }

    export type RequestMessage =
        | GetAllSvtTestsMessage
        | CreateSvtTestMessage

    export type ReplyMessage =
        | GetAllSvtTestsReplyMessage
        | CreateSvtTestReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}

