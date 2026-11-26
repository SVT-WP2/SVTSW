import { Injectable } from '@nestjs/common'
import { EpicUser, EpicUserRole } from 'svt-ts-types'
import { SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { SvtDbEnumsService, SvtDbUserEntity, SvtDbUsersRepository, SvtDbUserUpdateInput } from '../../../db/data'
import {
    optionalBoolean,
    optionalIntegerList,
    optionalPager,
    optionalRecord,
    optionalStringList,
    requireAllowedFilterKeys,
    requireInteger,
    requireRecord,
    requireString,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'

import {
    normalizeUserLogin,
    SVT_DB_AGENT_NEXT_PASSWORD_HASH_MAX_LENGTH,
    SvtDbAgentNextUserCreateDto,
    SvtDbAgentNextUserUpdateDto,
} from './svt-db-agent-next-users.dtos'


import MessageType = SvtDbAgentKafkaUsers.MessageType


/**
 * `GetAllUsers`, `GetUserCredentials`, `CreateUser`, `UpdateUser`, `UpdateUserPassword` (`docs/messages.md`
 * §3.18). Only the reply of `GetUserCredentials` holds the password hash, and no handler writes the hash to the
 * log. No message deletes a user (D5). The agent does not check who sends these messages (D12).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextUsersHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly users: SvtDbUsersRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            {
                type: MessageType.GetAllUsers,
                replyType: MessageType.GetAllUsersReply,
                handle: (data) => this.getAll(data),
            },
            {
                type: MessageType.GetUserCredentials,
                replyType: MessageType.GetUserCredentialsReply,
                handle: (data) => this.getCredentials(data),
            },
            {
                type: MessageType.CreateUser,
                replyType: MessageType.CreateUserReply,
                handle: (data) => this.create(data),
            },
            {
                type: MessageType.UpdateUser,
                replyType: MessageType.UpdateUserReply,
                handle: (data) => this.update(data),
            },
            {
                type: MessageType.UpdateUserPassword,
                replyType: MessageType.UpdateUserPasswordReply,
                handle: (data) => this.updatePassword(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafkaUsers.GetAllUsersReplyMessageData> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids', 'roles', 'isActive'])
        const pager = optionalPager(body['pager'], 'data.pager')
        const page = await this.users.findPage({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            roles: optionalStringList(filter['roles'], 'data.filter.roles'),
            isActive: optionalBoolean(filter['isActive'], 'data.filter.isActive'),
        }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    /** `data.login`, trimmed and compared in lower case. An inactive user is returned too: the caller decides. */
    private async getCredentials(data: unknown): Promise<SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessageData> {
        const login = requireString(requireRecord(data, 'data')['login'], 'data.login')
        const user = await this.users.findCredentialsByLogin(normalizeUserLogin(login))
        if (!user) {
            throw SvtDbAgentNextRequestError.notFound('No user with this login')
        }
        return { entity: { ...toWire(user), passwordHash: user.passwordHash } }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafkaUsers.CreateUserReplyMessageData> {
        const create = validateRequestData(SvtDbAgentNextUserCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        await this.requireRole(create.role)

        const user = await this.users.create({
            login: create.login,
            name: create.name,
            role: create.role,
            passwordHash: create.passwordHash,
        })
        return { entity: toWire(user) }
    }

    /** `data.id` + `data.update`. The last-Admin rule (D6) is checked in the transaction of the write. */
    private async update(data: unknown): Promise<SvtDbAgentKafkaUsers.UpdateUserReplyMessageData> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = validateRequestData(SvtDbAgentNextUserUpdateDto, body['update'], 'data.update')
        if (update.role !== undefined && update.role !== null) {
            await this.requireRole(update.role)
        }

        const result = await this.users.update(id, toPatch(update))
        switch (result.outcome) {
            case 'notFound':
                throw SvtDbAgentNextRequestError.notFound(`No user with id ${id}`)
            case 'lastActiveAdmin':
                throw SvtDbAgentNextRequestError.badRequest('The installation must keep one active Admin')
            case 'updated':
                return { entity: toWire(result.user) }
        }
    }

    /** `data.id` + `data.passwordHash`. */
    private async updatePassword(data: unknown): Promise<SvtDbAgentKafkaUsers.UpdateUserPasswordReplyMessageData> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const passwordHash = requireString(body['passwordHash'], 'data.passwordHash')
        if (passwordHash.length < 1 || passwordHash.length > SVT_DB_AGENT_NEXT_PASSWORD_HASH_MAX_LENGTH) {
            throw SvtDbAgentNextRequestError.badRequest(
                `data.passwordHash must be 1 to ${SVT_DB_AGENT_NEXT_PASSWORD_HASH_MAX_LENGTH} characters long`,
            )
        }

        const user = await this.users.updatePasswordHash(id, passwordHash)
        if (!user) {
            throw SvtDbAgentNextRequestError.notFound(`No user with id ${id}`)
        }
        return { entity: toWire(user) }
    }

    /** The enum check of `docs/messages.md` §2.7, against the live values of `userRole`. */
    private async requireRole(role: string): Promise<void> {
        const roles = await this.enums.getValues('userRole')
        if (!roles.includes(role)) {
            throw SvtDbAgentNextRequestError.badRequest(`${role} is not a value of the userRole enum`)
        }
    }

}

/** The keys of `data.update` that have a value; `null` keeps the value, as an absent key does. */
function toPatch(update: SvtDbAgentNextUserUpdateDto): SvtDbUserUpdateInput {
    const patch: SvtDbUserUpdateInput = {}
    if (update.name !== undefined && update.name !== null) {
        patch.name = update.name
    }
    if (update.role !== undefined && update.role !== null) {
        patch.role = update.role
    }
    if (update.isActive !== undefined && update.isActive !== null) {
        patch.isActive = update.isActive
    }
    return patch
}

/** A user as every service may see it: never the password hash. */
function toWire(user: SvtDbUserEntity): EpicUser {
    return {
        id: user.id,
        login: user.login,
        name: user.name,
        role: user.role as EpicUserRole,
        isActive: user.isActive,
        createdAt: user.createdAt.toISOString(),
    }
}
