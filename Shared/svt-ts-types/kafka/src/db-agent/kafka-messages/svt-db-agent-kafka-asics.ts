import { EpicApiPager, EpicAsic, EpicAsicCreateRequest } from 'epic-api-types'

import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'
import { EpicGetAllAsicsQueryFilter } from '../models'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaAsics {

    export enum MessageType {
        GetAllAsics = 'GetAllAsics',
        GetAllAsicsReply = 'GetAllAsicsReply',
        CreateAsic = 'CreateAsic',
        CreateAsicReply = 'CreateAsicReply',
    }

    // GET ALL

    export type GetAllAsicsMessageData = {
        filter?: EpicGetAllAsicsQueryFilter
        pager?: EpicApiPager
    }

    export class GetAllAsicsMessage extends EpicKafkaMessageClass<GetAllAsicsMessageData> {

        readonly type = MessageType.GetAllAsics

    }

    export type GetAllAsicsReplyMessageData = SvtDbAgentKafka.PageReplyMessageData<EpicAsic>

    export class GetAllAsicsReplyMessage extends EpicKafkaReplyMessageClass<GetAllAsicsReplyMessageData> {

        readonly type = MessageType.GetAllAsicsReply

    }

    // CREATE

    export type CreateAsicMessageData = {
        create: EpicAsicCreateRequest
    }

    export class CreateAsicMessage extends EpicKafkaMessageClass<CreateAsicMessageData> {

        readonly type = MessageType.CreateAsic

    }

    export type CreateAsicReplyMessageData = {
        entity: EpicAsic
    }

    export class CreateAsicReplyMessage extends EpicKafkaReplyMessageClass<CreateAsicReplyMessageData> {

        readonly type = MessageType.CreateAsicReply

    }

    export type RequestMessage =
        | GetAllAsicsMessage
        | CreateAsicMessage

    export type ReplyMessage =
        | GetAllAsicsReplyMessage
        | CreateAsicReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
