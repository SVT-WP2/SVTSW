import {
    EpicWpMachineCreateEntity,
    EpicWpMachineEntity,
    EpicWpMachineUpdateEntity,
    EpicWpMachineUpdateInstalledProbeCard,
    EpicWpMachineUpdateLoadedWafer,
} from '../../../wp'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaWpMachines {

    export enum MessageType {
        GetAllWpMachines = 'GetAllWaferProbeMachines',
        GetAllWpMachinesReply = 'GetAllWaferProbeMachinesReply',
        CreateWpMachine = 'CreateWaferProbeMachine',
        CreateWpMachineReply = 'CreateWaferProbeMachineReply',
        UpdateWpMachine = 'UpdateWaferProbeMachine',
        UpdateWpMachineReply = 'UpdateWaferProbeMachineReply',
        UpdateWpMachineLoadedWafer = 'UpdateWpMachineLoadedWafer',
        UpdateWpMachineLoadedWaferReply = 'UpdateWpMachineLoadedWaferReply',
        UpdateWpMachineInstalledProbeCard = 'UpdateWpMachineInstalledProbeCard',
        UpdateWpMachineInstalledProbeCardReply = 'UpdateWpMachineInstalledProbeCardReply',
    }

    // GET ALL


    export type GetAllWpMachinesData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllWpMachinesMessage extends EpicKafkaMessageClass<GetAllWpMachinesData> {

        readonly type = MessageType.GetAllWpMachines

    }

    export type GetAllWpMachinesReplyMessageData = {
        items: EpicWpMachineEntity[]
    }

    export class GetAllWpMachinesReplyMessage extends EpicKafkaReplyMessageClass<GetAllWpMachinesReplyMessageData> {

        readonly type = MessageType.GetAllWpMachinesReply

    }

    // CREATE

    export type CreateWpMachineMessageData = {
        create: EpicWpMachineCreateEntity
    }

    export class CreateWpMachineMessage extends EpicKafkaMessageClass<CreateWpMachineMessageData> {

        readonly type = MessageType.CreateWpMachine

    }

    export type CreateWpMachineReplyMessageData = {
        entity: EpicWpMachineEntity
    }

    export class CreateWpMachineReplyMessage extends EpicKafkaReplyMessageClass<CreateWpMachineReplyMessageData> {

        readonly type = MessageType.CreateWpMachineReply

    }

    // UPDATE

    export type UpdateWpMachineMessageData = {
        id: number
        update: EpicWpMachineUpdateEntity
    }

    export class UpdateWpMachineMessage extends EpicKafkaMessageClass<UpdateWpMachineMessageData> {

        readonly type = MessageType.UpdateWpMachine

    }

    export type UpdateWpMachineReplyMessageData = {
        entity: EpicWpMachineEntity
    }

    export class UpdateWpMachineReplyMessage extends EpicKafkaReplyMessageClass<UpdateWpMachineReplyMessageData> {

        readonly type = MessageType.UpdateWpMachineReply

    }

    // UPDATE LoadedWafer

    export class UpdateWpMachineLoadedWaferMessage extends EpicKafkaMessageClass<EpicWpMachineUpdateLoadedWafer> {

        readonly type = MessageType.UpdateWpMachineLoadedWafer

    }

    export type UpdateWpMachineLoadedWaferReplyMessageData = {
        entity: EpicWpMachineEntity
    }

    export class UpdateWpMachineLoadedWaferReplyMessage extends EpicKafkaReplyMessageClass<UpdateWpMachineLoadedWaferReplyMessageData> {

        readonly type = MessageType.UpdateWpMachineLoadedWaferReply

    }

    // UPDATE InstalledProbeCard

    export class UpdateWpMachineInstalledProbeCardMessage extends EpicKafkaMessageClass<EpicWpMachineUpdateInstalledProbeCard> {

        readonly type = MessageType.UpdateWpMachineInstalledProbeCard

    }

    export type UpdateWpMachineInstalledProbeCardReplyMessageData = {
        entity: EpicWpMachineEntity
    }

    export class UpdateWpMachineInstalledProbeCardReplyMessage
        extends EpicKafkaReplyMessageClass<UpdateWpMachineInstalledProbeCardReplyMessageData> {

        readonly type = MessageType.UpdateWpMachineInstalledProbeCardReply

    }

    export type RequestMessage =
        | GetAllWpMachinesMessage
        | CreateWpMachineMessage
        | UpdateWpMachineMessage
        | UpdateWpMachineLoadedWaferMessage
        | UpdateWpMachineInstalledProbeCardMessage

    export type ReplyMessage =
        | GetAllWpMachinesReplyMessage
        | CreateWpMachineReplyMessage
        | UpdateWpMachineReplyMessage
        | UpdateWpMachineLoadedWaferReplyMessage
        | UpdateWpMachineInstalledProbeCardReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
