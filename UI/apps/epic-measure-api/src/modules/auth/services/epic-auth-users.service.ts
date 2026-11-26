import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ClientKafka } from '@nestjs/microservices'
import { mapEpicKafkaMessageData } from 'epic/entities'
import { catchError, map, Observable, of, throwError } from 'rxjs'
import { EpicUser } from 'svt-ts-types'
import { EpicKafkaReplyMessage, EpicKafkaReplyStatus, EpicUserCredentials, SvtDbAgentKafka, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'

import { toEpicDbAgentKafkaRecord } from '../../../common'
import { EpicAuthSvc } from '../models'


/** The two user messages that the log-in and the guard need. The user management (ticket 396) has its own service. */
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

    onModuleInit(): void {
        this.kafkaClient.subscribeToResponseOf(SvtDbAgentKafka.TopicName.Request)
    }

    protected sendMessageAndGetReply<TReplyMessage>(message: SvtDbAgentKafkaUsers.Message): Observable<TReplyMessage> {
        return this.kafkaClient
            .send<TReplyMessage>(SvtDbAgentKafka.TopicName.Request, toEpicDbAgentKafkaRecord(message))
    }

}
