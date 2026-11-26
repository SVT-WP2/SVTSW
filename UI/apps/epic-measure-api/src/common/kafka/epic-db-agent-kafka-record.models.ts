import { EpicKafkaMessage, SvtKafkaHeader } from 'svt-ts-types/kafka'

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
 * current HTTP request (ticket 392, D9). Without a user in the request context (the log-in itself) the record has
 * no header at all: the DB agent refuses a header without a valid value.
 *
 * Call it when the service method is called, not inside the Observable that `send` returns: the call runs in the
 * request context, a later subscription may not.
 */
export function toEpicDbAgentKafkaRecord(message: EpicKafkaMessage): EpicDbAgentKafkaRecord {
    const value = JSON.stringify(message)
    const userId = EpicRequestContext.getUserId()
    if (userId === undefined) {
        return { value }
    }
    return { value, headers: { [SvtKafkaHeader.UserId]: String(userId) } }
}
