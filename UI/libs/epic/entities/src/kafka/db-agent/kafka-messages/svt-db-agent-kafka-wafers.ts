import { EpicWaferCreateEntity, EpicWaferEntity, EpicWaferLocationHistoryRecordEntity, EpicWaferUpdateEntity } from '../../../wafers'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaWafers {

    export enum MessageType {
        GetAllWafers = 'GetAllWafers',
        GetAllWafersReply = 'GetAllWafersReply',
        CreateWafer = 'CreateWafer',
        CreateWaferReply = 'CreateWaferReply',
        UpdateWafer = 'UpdateWafer',
        UpdateWaferReply = 'UpdateWaferReply',
        UpdateWaferLocation = 'UpdateWaferLocation',
        UpdateWaferLocationReply = 'UpdateWaferLocationReply',
        GetWaferLocationHistory = 'GetWaferLocationHistory',
        GetWaferLocationHistoryReply = 'GetWaferLocationHistoryReply',
    }

    // GET ALL

    export type GetAllWaferMessageData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllWafersMessage extends EpicKafkaMessageClass<GetAllWaferMessageData> {

        readonly type = MessageType.GetAllWafers

    }

    export type GetAllWafersReplyMessageData = {
        items: EpicWaferEntity[]
    }

    export class GetAllWafersReplyMessage extends EpicKafkaReplyMessageClass<GetAllWafersReplyMessageData> {

        readonly type = MessageType.GetAllWafersReply

    }

    // CREATE

    export type CreateWaferMessageData = {
        create: EpicWaferCreateEntity
    }

    export class CreateWaferMessage extends EpicKafkaMessageClass<CreateWaferMessageData> {

        readonly type = MessageType.CreateWafer

    }

    export type CreateWaferReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWaferEntity>

    export class CreateWaferReplyMessage extends EpicKafkaReplyMessageClass<CreateWaferReplyMessageData> {

        readonly type = MessageType.CreateWaferReply

    }

    // UPDATE

    export type UpdateWaferMessageData = {
        id: number
        update: Partial<EpicWaferUpdateEntity>
    }

    export class UpdateWaferMessage extends EpicKafkaMessageClass<UpdateWaferMessageData> {

        readonly type = MessageType.UpdateWafer

    }

    export type UpdateWaferReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWaferEntity>

    export class UpdateWaferReplyMessage extends EpicKafkaReplyMessageClass<UpdateWaferReplyMessageData> {

        readonly type = MessageType.UpdateWaferReply

    }

    // LOCATION

    export class UpdateWaferLocationMessage extends EpicKafkaMessageClass<EpicWaferLocationHistoryRecordEntity> {

        readonly type = MessageType.UpdateWaferLocation

    }

    export type UpdateWaferLocationReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicWaferEntity>

    export class UpdateWaferLocationReplyMessage extends EpicKafkaReplyMessageClass<UpdateWaferLocationReplyMessageData> {

        readonly type = MessageType.UpdateWaferLocationReply

    }

    export type GetWaferLocationHistoryMessageData = {
        waferId: number
    }

    export class GetWaferLocationHistoryMessage extends EpicKafkaMessageClass<GetWaferLocationHistoryMessageData> {

        readonly type = MessageType.GetWaferLocationHistory

    }

    export type GetWaferLocationHistoryReplyMessageData = SvtDbAgentKafka.ListReplyMessageData<EpicWaferLocationHistoryRecordEntity>

    export class GetWaferLocationHistoryReplyMessage extends EpicKafkaReplyMessageClass<GetWaferLocationHistoryReplyMessageData> {

        readonly type = MessageType.GetWaferLocationHistoryReply

    }


    export type RequestMessage =
        | GetAllWafersMessage
        | CreateWaferMessage
        | UpdateWaferMessage
        | UpdateWaferLocationMessage
        | GetWaferLocationHistoryMessage

    export type ReplyMessage =
        | GetAllWafersReplyMessage
        | CreateWaferReplyMessage
        | UpdateWaferReplyMessage
        | UpdateWaferLocationReplyMessage
        | GetWaferLocationHistoryReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
