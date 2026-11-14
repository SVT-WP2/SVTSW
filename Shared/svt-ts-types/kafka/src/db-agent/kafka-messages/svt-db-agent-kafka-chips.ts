import { EpicApiPager, EpicChip, EpicChipCreateManyRequest, EpicChipCreateRequest, EpicChipLocationHistoryRecord } from 'epic-api-types'

import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'
import { EpicGetAllChipsQueryFilter } from '../models'

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
        pager?: EpicApiPager
    }

    export class GetAllChipsMessage extends EpicKafkaMessageClass<GetAllChipsMessageData> {

        readonly type = MessageType.GetAllChips

    }

    export type GetAllChipsReplyMessageData = SvtDbAgentKafka.PageReplyMessageData<EpicChip>

    export class GetAllChipsReplyMessage extends EpicKafkaReplyMessageClass<GetAllChipsReplyMessageData> {

        readonly type = MessageType.GetAllChipsReply

    }

    // CREATE

    export type CreateChipMessageData = {
        create: EpicChipCreateRequest
    }

    export class CreateChipMessage extends EpicKafkaMessageClass<CreateChipMessageData> {

        readonly type = MessageType.CreateChip

    }

    export type CreateChipReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicChip>

    export class CreateChipReplyMessage extends EpicKafkaReplyMessageClass<CreateChipReplyMessageData> {

        readonly type = MessageType.CreateChipReply

    }

    // CREATE MANY

    export type CreateManyChipsMessageData = {
        create: EpicChipCreateManyRequest
    }

    export class CreateManyChipsMessage extends EpicKafkaMessageClass<CreateManyChipsMessageData> {

        readonly type = MessageType.CreateManyChips

    }

    export type CreateManyChipsReplyMessageData = SvtDbAgentKafka.ListReplyMessageData<EpicChip>

    export class CreateManyChipsReplyMessage extends EpicKafkaReplyMessageClass<CreateManyChipsReplyMessageData> {

        readonly type = MessageType.CreateManyChipsReply

    }


    // LOCATION

    export class UpdateChipLocationMessage extends EpicKafkaMessageClass<EpicChipLocationHistoryRecord> {

        readonly type = MessageType.UpdateChipLocation

    }

    export type UpdateChipLocationReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicChip>

    export class UpdateChipLocationReplyMessage extends EpicKafkaReplyMessageClass<UpdateChipLocationReplyMessageData> {

        readonly type = MessageType.UpdateChipLocationReply

    }

    export type GetChipLocationHistoryMessageData = {
        chipId: number
    }

    export class GetChipLocationHistoryMessage extends EpicKafkaMessageClass<GetChipLocationHistoryMessageData> {

        readonly type = MessageType.GetChipLocationHistory

    }

    export type GetChipLocationHistoryReplyMessageData = SvtDbAgentKafka.ListReplyMessageData<EpicChipLocationHistoryRecord>

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
