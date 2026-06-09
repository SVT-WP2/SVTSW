import { EpicApiEnumsCollection } from '../../../enums'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaEnums {

    export enum MessageType {
        GetAllEnums = 'GetAllEnums',
        GetAllEnumsReply = 'GetAllEnumsReply',
    }

    // GET ALL

    export type GetAllEnumsMessageData = {
        filter?: {
            enumNames?: string[]
        }
    }

    export class GetAllEnumsMessage extends EpicKafkaMessageClass<GetAllEnumsMessageData> {

        readonly type = MessageType.GetAllEnums

    }

    export class GetAllEnumsReplyMessage extends EpicKafkaReplyMessageClass<Partial<EpicApiEnumsCollection>> {

        readonly type = MessageType.GetAllEnumsReply

    }

    export type RequestMessage =
        | GetAllEnumsMessage

    export type ReplyMessage =
        | GetAllEnumsReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
