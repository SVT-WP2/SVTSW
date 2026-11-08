import { EpicWpProject, EpicWpProjectCreateRequest } from 'svt-ts-types'

import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'


export namespace SvtDbAgentKafkaWpProjects {

    export enum MessageType {
        GetAllWpProjects = 'GetAllWaferProbeProjects',
        GetAllWpProjectsReply = 'GetAllWaferProbeProjectsReply',
        CreateWpProject = 'CreateWaferProbeProject',
        CreateWpProjectReply = 'CreateWaferProbeProjectReply',
    }

    // GET ALL


    export type GetAllWpProjectsData = {
        filter?: {
            ids?: number[]
        }
    }

    export class GetAllWpProjectsMessage extends EpicKafkaMessageClass<GetAllWpProjectsData> {

        readonly type = MessageType.GetAllWpProjects

    }

    export type GetAllWpProjectsReplyMessageData = {
        items: EpicWpProject[]
    }

    export class GetAllWpProjectsReplyMessage extends EpicKafkaReplyMessageClass<GetAllWpProjectsReplyMessageData> {

        readonly type = MessageType.GetAllWpProjectsReply

    }

    // CREATE

    export type CreateWpProjectMessageData = {
        create: EpicWpProjectCreateRequest
    }

    export class CreateWpProjectMessage extends EpicKafkaMessageClass<CreateWpProjectMessageData> {

        readonly type = MessageType.CreateWpProject

    }

    export type CreateWpProjectReplyMessageData = {
        entity: EpicWpProject
    }

    export class CreateWpProjectReplyMessage extends EpicKafkaReplyMessageClass<CreateWpProjectReplyMessageData> {

        readonly type = MessageType.CreateWpProjectReply

    }

    export type RequestMessage =
        | GetAllWpProjectsMessage
        | CreateWpProjectMessage

    export type ReplyMessage =
        | GetAllWpProjectsReplyMessage
        | CreateWpProjectReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
