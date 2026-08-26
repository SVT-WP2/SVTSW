import { EpicChipBlockEntity, EpicGetAllChipBlocksQueryFilter } from '../../../chip-blocks'
import { EpicPager } from '../../../common'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaChipBlocks {

    export enum MessageType {
        GetAllChipBlocks = 'GetAllBlocks',
        GetAllChipBlocksReply = 'GetAllBlocksReply',
    }

    // GET ALL

    export type GetAllChipBlocksMessageData = {
        filter?: EpicGetAllChipBlocksQueryFilter
        pager?: EpicPager
    }

    export class GetAllChipBlocksMessage extends EpicKafkaMessageClass<GetAllChipBlocksMessageData> {

        readonly type = MessageType.GetAllChipBlocks

    }

    export type GetAllChipBlocksReplyMessageData = SvtDbAgentKafka.PageReplyMessageData<EpicChipBlockEntity>

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
