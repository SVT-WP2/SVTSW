import { ClientKafka } from '@nestjs/microservices'
import { Observable } from 'rxjs'
import { EpicKafkaMessage, SvtDbAgentKafka, SvtKafkaHeader } from 'svt-ts-types/kafka'

import { EpicRequestContext } from '../request-context'


/**
 * A Kafka record as `ClientKafka.send` takes it. NestJS treats an object with a `value` key as a record and sends its
 * `headers` (`KafkaRequestSerializer`), next to the headers of the request-reply convention that it adds itself.
 */
export type EpicDbAgentKafkaRecord = {
    value: string
    headers?: Record<string, string>
}

/**
 * The record of a request to the DB agent: the message as JSON, and the header `svt_userId` with the user of the
 * request context in which it is called (ticket 392, D9). Without a user (the log-in, a request at boot) the record
 * has no header at all: the DB agent refuses a header without a valid value. Services send through
 * `sendEpicDbAgentRequest`, which calls it.
 */
export function toEpicDbAgentKafkaRecord(message: EpicKafkaMessage): EpicDbAgentKafkaRecord {
    const value = JSON.stringify(message)
    const userId = EpicRequestContext.getUserId()
    if (userId === undefined) {
        return { value }
    }
    return { value, headers: { [SvtKafkaHeader.UserId]: String(userId) } }
}

/**
 * Sends a request to the DB agent and returns its reply. Every Kafka service of the BFF sends through it.
 *
 * - The record (with `svt_userId`) is made when this function is called, in the context of the caller.
 * - The reply is delivered in that same context. A request sent while reacting to the reply (a `switchMap` on the
 *   returned Observable) therefore carries the user of the HTTP request that started the chain, and no header when
 *   that request had no user, whatever request the Kafka client served first.
 */
export function sendEpicDbAgentRequest<TReply>(client: ClientKafka, message: EpicKafkaMessage): Observable<TReply> {
    const record = toEpicDbAgentKafkaRecord(message)
    const context = EpicRequestContext.capture()
    return client.send<TReply>(SvtDbAgentKafka.TopicName.Request, record)
        .pipe(
            EpicRequestContext.deliverIn(context),
        )
}
