import { EpicApiPager, EpicUser, EpicUserRole } from 'svt-ts-types'

import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'
import { EpicUserCreate, EpicUserCredentials } from '../models'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


/**
 * The users of the installation and their roles. Only `GetUserCredentials` replies with the password hash; every
 * other reply carries `EpicUser`, which has no hash. No message deletes a user.
 */
export namespace SvtDbAgentKafkaUsers {

    export enum MessageType {
        GetAllUsers = 'GetAllUsers',
        GetAllUsersReply = 'GetAllUsersReply',
        GetUserCredentials = 'GetUserCredentials',
        GetUserCredentialsReply = 'GetUserCredentialsReply',
        CreateUser = 'CreateUser',
        CreateUserReply = 'CreateUserReply',
        UpdateUser = 'UpdateUser',
        UpdateUserReply = 'UpdateUserReply',
        UpdateUserPassword = 'UpdateUserPassword',
        UpdateUserPasswordReply = 'UpdateUserPasswordReply',
    }

    // GET ALL

    export type GetAllUsersFilter = {
        ids?: number[]
        roles?: EpicUserRole[]
        isActive?: boolean
    }

    export type GetAllUsersMessageData = {
        filter?: GetAllUsersFilter
        pager?: Partial<EpicApiPager>
    }

    export class GetAllUsersMessage extends EpicKafkaMessageClass<GetAllUsersMessageData> {

        readonly type = MessageType.GetAllUsers

    }

    export type GetAllUsersReplyMessageData = SvtDbAgentKafka.PageReplyMessageData<EpicUser>

    export class GetAllUsersReplyMessage extends EpicKafkaReplyMessageClass<GetAllUsersReplyMessageData> {

        readonly type = MessageType.GetAllUsersReply

    }

    // GET CREDENTIALS

    export type GetUserCredentialsMessageData = {
        /** Compared in lower case, after trimming. */
        login: string
    }

    export class GetUserCredentialsMessage extends EpicKafkaMessageClass<GetUserCredentialsMessageData> {

        readonly type = MessageType.GetUserCredentials

    }

    export type GetUserCredentialsReplyMessageData = {
        entity: EpicUserCredentials
    }

    export class GetUserCredentialsReplyMessage extends EpicKafkaReplyMessageClass<GetUserCredentialsReplyMessageData> {

        readonly type = MessageType.GetUserCredentialsReply

    }

    // CREATE

    export type CreateUserMessageData = {
        create: EpicUserCreate
    }

    export class CreateUserMessage extends EpicKafkaMessageClass<CreateUserMessageData> {

        readonly type = MessageType.CreateUser

    }

    export type CreateUserReplyMessageData = {
        entity: EpicUser
    }

    export class CreateUserReplyMessage extends EpicKafkaReplyMessageClass<CreateUserReplyMessageData> {

        readonly type = MessageType.CreateUserReply

    }

    // UPDATE

    /** `data.update` of `UpdateUser`. An absent key keeps the value. The login cannot be changed. */
    export type UserUpdate = {
        name?: string
        role?: EpicUserRole
        isActive?: boolean
    }

    export type UpdateUserMessageData = {
        id: number
        update: UserUpdate
    }

    export class UpdateUserMessage extends EpicKafkaMessageClass<UpdateUserMessageData> {

        readonly type = MessageType.UpdateUser

    }

    export type UpdateUserReplyMessageData = {
        entity: EpicUser
    }

    export class UpdateUserReplyMessage extends EpicKafkaReplyMessageClass<UpdateUserReplyMessageData> {

        readonly type = MessageType.UpdateUserReply

    }

    // UPDATE PASSWORD

    export type UpdateUserPasswordMessageData = {
        id: number
        passwordHash: string
    }

    export class UpdateUserPasswordMessage extends EpicKafkaMessageClass<UpdateUserPasswordMessageData> {

        readonly type = MessageType.UpdateUserPassword

    }

    export type UpdateUserPasswordReplyMessageData = {
        entity: EpicUser
    }

    export class UpdateUserPasswordReplyMessage extends EpicKafkaReplyMessageClass<UpdateUserPasswordReplyMessageData> {

        readonly type = MessageType.UpdateUserPasswordReply

    }

    export type RequestMessage =
        | GetAllUsersMessage
        | GetUserCredentialsMessage
        | CreateUserMessage
        | UpdateUserMessage
        | UpdateUserPasswordMessage

    export type ReplyMessage =
        | GetAllUsersReplyMessage
        | GetUserCredentialsReplyMessage
        | CreateUserReplyMessage
        | UpdateUserReplyMessage
        | UpdateUserPasswordReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
