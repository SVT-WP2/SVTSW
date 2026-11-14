import { EpicApiPager, EpicChipBlock } from 'svt-ts-types'

import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'
import { EpicGetAllChipBlocksQueryFilter } from '../models'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaChipBlocks {

    export enum MessageType {
        GetAllChipBlocks = 'GetAllBlocks',
        GetAllChipBlocksReply = 'GetAllBlocksReply',
    }

    // GET ALL

    export type GetAllChipBlocksMessageData = {
        filter?: EpicGetAllChipBlocksQueryFilter
        pager?: EpicApiPager
    }

    export class GetAllChipBlocksMessage extends EpicKafkaMessageClass<GetAllChipBlocksMessageData> {

        readonly type = MessageType.GetAllChipBlocks

    }

    export type GetAllChipBlocksReplyMessageData = SvtDbAgentKafka.PageReplyMessageData<EpicChipBlock>

    export class GetAllChipBlocksReplyMessage extends EpicKafkaReplyMessageClass<GetAllChipBlocksReplyMessageData> {

        readonly type = MessageType.GetAllChipBlocksReply

    }

    export type RequestMessage =
        | GetAllChipBlocksMessage

    export type ReplyMessage =
        | GetAllChipBlocksReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
