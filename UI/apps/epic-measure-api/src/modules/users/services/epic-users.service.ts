import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { hashEpicPassword } from 'epic/core'
import { mapEpicKafkaMessageData, mapSvtDbAgentEntityReplyData, mapSvtDbAgentListReplyData } from 'epic/entities'
import { firstValueFrom, map, Observable } from 'rxjs'
import { EpicUser, EpicUserCreateRequest, EpicUserUpdateRequest, normalizeEpicUserLogin } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { sendEpicDbAgentRequest } from '../../../common'
import { EpicAuthUserCacheService } from '../../auth'
import { EpicUsersSvc, toEpicUser } from '../models'


type EntityReplyMessage =
    | SvtDbAgentKafkaUsers.CreateUserReplyMessage
    | SvtDbAgentKafkaUsers.UpdateUserReplyMessage
    | SvtDbAgentKafkaUsers.UpdateUserPasswordReplyMessage

/**
 * The user management of an Admin (ticket 396): `GetAllUsers`, `CreateUser`, `UpdateUser` and `UpdateUserPassword`.
 * A plain password stays in this process: it is hashed here and only the hash is sent. After a change of a user, the
 * user is dropped from the cache of the guard, so that the change counts from the user's next request.
 *
 * The methods are `async`: the record of a request is made after the hash, still in the request context of the
 * caller (`AsyncLocalStorage` keeps it across `await`), so it carries the `svt_userId` of the Admin.
 */
@Injectable()
export class EpicUsersService implements OnModuleInit {

    constructor(
        @Inject(EpicUsersSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
        private readonly userCache: EpicAuthUserCacheService,
    ) {
    }

    /** Every user, active or not, in ascending order of id. */
    getAll(): Promise<EpicUser[]> {
        const message = new SvtDbAgentKafkaUsers.GetAllUsersMessage({})
        return firstValueFrom(
            this.sendMessageAndGetReply<SvtDbAgentKafkaUsers.GetAllUsersReplyMessage>(message)
                .pipe(
                    mapEpicKafkaMessageData(),
                    mapSvtDbAgentListReplyData(),
                    map((users) => users.map(toEpicUser)),
                ),
        )
    }

    /** A new active user. The login is trimmed and put in lower case here; the DB agent checks the login rule. */
    async create(request: EpicUserCreateRequest): Promise<EpicUser> {
        const passwordHash = await hashEpicPassword(request.password)
        const message = new SvtDbAgentKafkaUsers.CreateUserMessage({
            create: {
                login: normalizeEpicUserLogin(request.login),
                name: request.name,
                role: request.role,
                passwordHash,
            },
        })
        return this.sendAndGetUser(message)
    }

    /** Changes the name, the role or the state of a user. An absent key keeps the value. */
    async update(id: number, update: EpicUserUpdateRequest): Promise<EpicUser> {
        const message = new SvtDbAgentKafkaUsers.UpdateUserMessage({
            id,
            update: { name: update.name, role: update.role, isActive: update.isActive },
        })
        try {
            return await this.sendAndGetUser(message)
        }
        finally {
            // Also after a failure: the write may have happened although no reply arrived.
            this.userCache.forget(id)
        }
    }

    /** Sets a new password of a user, without its current one. */
    async setPassword(id: number, password: string): Promise<EpicUser> {
        const passwordHash = await hashEpicPassword(password)
        const message = new SvtDbAgentKafkaUsers.UpdateUserPasswordMessage({ id, passwordHash })
        try {
            return await this.sendAndGetUser(message)
        }
        finally {
            this.userCache.forget(id)
        }
    }

    onModuleInit(): void {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendAndGetUser(message: SvtDbAgentKafkaUsers.RequestMessage): Promise<EpicUser> {
        return firstValueFrom(
            this.sendMessageAndGetReply<EntityReplyMessage>(message)
                .pipe(
                    mapEpicKafkaMessageData(),
                    mapSvtDbAgentEntityReplyData(),
                    map(toEpicUser),
                ),
        )
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaUsers.RequestMessage): Observable<TReplyMessage> {
        return sendEpicDbAgentRequest<TReplyMessage>(this.kafkaClient, message)
    }

}
