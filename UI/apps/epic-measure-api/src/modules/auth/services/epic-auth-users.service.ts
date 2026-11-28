import { Inject, Injectable, OnModuleInit, ServiceUnavailableException } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData } from 'epic/entities'
import { catchError, map, MonoTypeOperatorFunction, Observable, of, throwError, timeout } from 'rxjs'
import { EpicUser } from 'svt-ts-types'
import { EpicKafkaReplyMessage, EpicKafkaReplyStatus, EpicUserCredentials, SvtDbAgentKafka, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { sendEpicDbAgentRequest } from '../../../common'
import { EpicAuthSvc } from '../models'


/**
 * The user messages that the log-in, the guard and the change of the own password need. The user management of an
 * Admin (ticket 396) has its own service (`modules/users`). Every request has a timeout
 * (`EpicAuthSvc.DB_AGENT_TIMEOUT_MS`): a log-in or a guard read that gets no reply (the DB agent is down, or skipped
 * the request at its start) ends with `503`, so it can never hold the next log-in of its login.
 */
@Injectable()
export class EpicAuthUsersService implements OnModuleInit {

    constructor(
        @Inject(EpicAuthSvc.SERVICE_NAME) private readonly kafkaClient: ClientKafka,
    ) {
    }

    /** The user with the login and the hash of its password; `null` when no user has the login. */
    getCredentials(login: string): Observable<EpicUserCredentials | null> {
        const message = new SvtDbAgentKafkaUsers.GetUserCredentialsMessage({ login })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaUsers.GetUserCredentialsReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                map((data) => data.entity),
                catchError((error: unknown) => (error as EpicKafkaReplyMessage)?.status === EpicKafkaReplyStatus.NotFound
                    ? of(null)
                    : throwError(() => error)),
            )
    }

    /** The user with the id, active or not; `null` when there is none. */
    getById(id: number): Observable<EpicUser | null> {
        const message = new SvtDbAgentKafkaUsers.GetAllUsersMessage({ filter: { ids: [id] } })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaUsers.GetAllUsersReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                map((data) => data.items.find((user) => user.id === id) ?? null),
            )
    }

    /** Sets the password hash of a user (the own password: `POST /api/auth/password`). */
    updatePasswordHash(id: number, passwordHash: string): Observable<EpicUser> {
        const message = new SvtDbAgentKafkaUsers.UpdateUserPasswordMessage({ id, passwordHash })
        return this.sendMessageAndGetReply<SvtDbAgentKafkaUsers.UpdateUserPasswordReplyMessage>(message)
            .pipe(
                mapEpicKafkaMessageData(),
                map((data) => data.entity),
            )
    }

    onModuleInit(): void {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaUsers.Message): Observable<TReplyMessage> {
        return sendEpicDbAgentRequest<TReplyMessage>(this.kafkaClient, message)
            .pipe(
                timeoutAsServiceUnavailable(),
            )
    }

}

/** No reply within `EpicAuthSvc.DB_AGENT_TIMEOUT_MS`: `503` (unsubscribing drops the pending request of the client). */
function timeoutAsServiceUnavailable<T>(): MonoTypeOperatorFunction<T> {
    return timeout({
        first: EpicAuthSvc.DB_AGENT_TIMEOUT_MS,
        with: () => throwError(() => new ServiceUnavailableException(EpicAuthSvc.DB_AGENT_TIMEOUT_MESSAGE)),
    })
}
