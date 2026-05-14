import { EpicWpProbeCardEntity } from '../../../wp'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaWpProbeCards {

    export enum MessageType {
        GetAllWpProbeCards = 'GetAllProbeCards',
        GetAllWpProbeCardsReply = 'GetAllProbeCardsReply',
    }

    // GET ALL


    export type GetAllWpProbeCardsData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllWpProbeCardsMessage extends EpicKafkaMessageClass<GetAllWpProbeCardsData> {

        readonly type = MessageType.GetAllWpProbeCards

    }

    export type GetAllWpProbeCardsReplyMessageData = {
        items: EpicWpProbeCardEntity[]
    }

    export class GetAllWpProbeCardsReplyMessage extends EpicKafkaReplyMessageClass<GetAllWpProbeCardsReplyMessageData> {

        readonly type = MessageType.GetAllWpProbeCardsReply

    }

    export type RequestMessage =
        | GetAllWpProbeCardsMessage

    export type ReplyMessage =
        | GetAllWpProbeCardsReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
