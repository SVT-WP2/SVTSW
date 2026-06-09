import {
    EpicChipCreateEntity,
    EpicChipCreateManyEntity,
    EpicChipEntity,
    EpicChipLocationHistoryRecordEntity,
    EpicGetAllChipsQueryFilter,
} from '../../../chips'
import { EpicPager } from '../../../common'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaChips {

    export enum MessageType {
        GetAllChips = 'GetAllChips',
        GetAllChipsReply = 'GetAllChipsReply',
        CreateChip = 'CreateChip',
        CreateChipReply = 'CreateChipReply',
        CreateManyChips = 'CreateManyChips',
        CreateManyChipsReply = 'CreateManyChipsReply',
        UpdateChipLocation = 'UpdateChipLocation',
        UpdateChipLocationReply = 'UpdateChipLocationReply',
        GetChipLocationHistory = 'GetChipLocationHistory',
        GetChipLocationHistoryReply = 'GetChipLocationHistoryReply',
    }

    // GET ALL

    export type GetAllChipsMessageData = {
        filter?: EpicGetAllChipsQueryFilter
        pager?: EpicPager
    }

    export class GetAllChipsMessage extends EpicKafkaMessageClass<GetAllChipsMessageData> {

        readonly type = MessageType.GetAllChips

    }

    export type GetAllChipsReplyMessageData = SvtDbAgentKafka.PageReplyMessageData<EpicChipEntity>

    export class GetAllChipsReplyMessage extends EpicKafkaReplyMessageClass<GetAllChipsReplyMessageData> {

        readonly type = MessageType.GetAllChipsReply

    }

    // CREATE

    export type CreateChipMessageData = {
        create: EpicChipCreateEntity
    }

    export class CreateChipMessage extends EpicKafkaMessageClass<CreateChipMessageData> {

        readonly type = MessageType.CreateChip

    }

    export type CreateChipReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicChipEntity>

    export class CreateChipReplyMessage extends EpicKafkaReplyMessageClass<CreateChipReplyMessageData> {

        readonly type = MessageType.CreateChipReply

    }

    // CREATE MANY

    export type CreateManyChipsMessageData = {
        create: EpicChipCreateManyEntity
    }

    export class CreateManyChipsMessage extends EpicKafkaMessageClass<CreateManyChipsMessageData> {

        readonly type = MessageType.CreateManyChips

    }

    export type CreateManyChipsReplyMessageData = SvtDbAgentKafka.ListReplyMessageData<EpicChipEntity>

    export class CreateManyChipsReplyMessage extends EpicKafkaReplyMessageClass<CreateManyChipsReplyMessageData> {

        readonly type = MessageType.CreateManyChipsReply

    }


    // LOCATION

    export class UpdateChipLocationMessage extends EpicKafkaMessageClass<EpicChipLocationHistoryRecordEntity> {

        readonly type = MessageType.UpdateChipLocation

    }

    export type UpdateChipLocationReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicChipEntity>

    export class UpdateChipLocationReplyMessage extends EpicKafkaReplyMessageClass<UpdateChipLocationReplyMessageData> {

        readonly type = MessageType.UpdateChipLocationReply

    }

    export type GetChipLocationHistoryMessageData = {
        chipId: number
    }

    export class GetChipLocationHistoryMessage extends EpicKafkaMessageClass<GetChipLocationHistoryMessageData> {

        readonly type = MessageType.GetChipLocationHistory

    }

    export type GetChipLocationHistoryReplyMessageData = SvtDbAgentKafka.ListReplyMessageData<EpicChipLocationHistoryRecordEntity>

    export class GetChipLocationHistoryReplyMessage extends EpicKafkaReplyMessageClass<GetChipLocationHistoryReplyMessageData> {

        readonly type = MessageType.GetChipLocationHistoryReply

    }


    export type RequestMessage =
        | GetAllChipsMessage
        | CreateChipMessage
        | UpdateChipLocationMessage
        | GetChipLocationHistoryMessage
        | CreateManyChipsMessage

    export type ReplyMessage =
        | GetAllChipsReplyMessage
        | CreateChipReplyMessage
        | UpdateChipLocationReplyMessage
        | GetChipLocationHistoryReplyMessage
        | CreateManyChipsReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
