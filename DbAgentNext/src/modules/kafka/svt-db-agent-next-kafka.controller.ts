import { Controller, Logger } from '@nestjs/common'
import { Ctx, KafkaContext, MessagePattern, Payload } from '@nestjs/microservices'
import { EpicKafkaReplyStatus, SvtDbAgentKafka, SvtKafkaHeader } from 'svt-ts-types/kafka'

import { isRecord, parseUserIdHeader, SvtDbAgentNextReply, SvtDbAgentNextRequestDispatcher } from '../dispatch'


/** The type of the log lines and of a fallback reply for a body without a string `type`. */
const NO_TYPE = '<no type>'

/**
 * The Kafka side of the agent: one method for every record of `svt.db-agent.request`. The payload goes to
 * the dispatcher as the e2e harness sends it, and the returned **string** becomes the value of the reply
 * record (NestJS adds `kafka_correlationId` and `kafka_replyPartition` from the request headers and sends it
 * to the request's `kafka_replyTopic`). Nothing is ever thrown out of here: an exception would become a
 * `kafka_nest-err` header the clients do not understand.
 *
 * It reads the header `svt_userId` of the record and hands its text to the dispatcher, or `null` for a header that
 * is there without text (`headerText`); the dispatcher checks it. The reply does not repeat the header. The log line
 * of each request names the type, the status, the duration, the user and the correlation id, and prints no value of
 * the record raw: a type, a user or a correlation id that is not a short text of safe characters becomes a fixed word.
 */
@Controller()
export class SvtDbAgentNextKafkaController {

    private readonly logger = new Logger(SvtDbAgentNextKafkaController.name)

    constructor(private readonly dispatcher: SvtDbAgentNextRequestDispatcher) {
    }

    @MessagePattern(SvtDbAgentKafka.TopicName.Request)
    async handleRequest(@Payload() value: unknown, @Ctx() context: KafkaContext): Promise<string> {
        const startedAt = Date.now()
        const requestType = isRecord(value) && typeof value['type'] === 'string' ? value['type'] : NO_TYPE
        const userId = headerText(context, SvtKafkaHeader.UserId)
        let reply: SvtDbAgentNextReply
        try {
            reply = await this.dispatcher.dispatch(value, { userId })
        }
        catch (error) {
            // The dispatcher answers every failure itself; this is the last line of defence.
            this.logger.error(`${typeForLog(requestType)}: the dispatcher threw`, error instanceof Error ? error.stack : String(error))
            reply = {
                type: `${requestType}Reply`,
                status: EpicKafkaReplyStatus.UnexpectedError,
                data: null,
                error: { code: -1, message: `Unexpected error while processing ${requestType}` },
            }
        }
        this.logger.log(
            `${typeForLog(requestType)} → ${reply.status} in ${Date.now() - startedAt} ms user=${userForLog(userId)}`
            + correlationSuffix(context),
        )
        return JSON.stringify(reply)
    }

}

/** A correlation id that the log line prints as it is: a UUID or another short id of safe characters. */
const SAFE_CORRELATION_ID = /^[A-Za-z0-9._:-]{1,100}$/

/** A message type that the log lines print as it is: the names of the contract are letters and digits. */
const SAFE_TYPE = /^[A-Za-z0-9_.-]{1,100}$/

/**
 * The type of the log lines: the type of the body when it is a short text of safe characters, `<no type>` when the
 * body has none, `<invalid type>` otherwise. The log lines only: the reply keeps the type as it came.
 */
function typeForLog(requestType: string): string {
    return requestType === NO_TYPE || SAFE_TYPE.test(requestType) ? requestType : '<invalid type>'
}

/**
 * The text of one header of the record. NestJS's `KafkaParser` has decoded every header before the controller sees
 * it: a string; a `Buffer` (a value that starts with a zero byte); `null` (a header without a value); or, for text
 * that starts with `[` or `{` and is valid JSON, the parsed array or object. A header that the record has twice
 * arrives as one string, its values joined by a comma.
 *
 * Returns the text of a string or a `Buffer` (UTF-8); `null` for a header that is there without text (a null value, a
 * parsed array or object), which the check of the dispatcher refuses; `undefined` when the record has no such header.
 * It never converts an object to a string, and it cannot throw.
 */
function headerText(context: KafkaContext, name: string): string | null | undefined {
    try {
        const headers: unknown = context.getMessage()?.headers
        if (typeof headers !== 'object' || headers === null || !Object.prototype.hasOwnProperty.call(headers, name)) {
            return undefined
        }
        const raw: unknown = (headers as Record<string, unknown>)[name]
        if (raw === undefined) {
            return undefined
        }
        if (typeof raw === 'string') {
            return raw
        }
        return Buffer.isBuffer(raw) ? raw.toString('utf8') : null
    }
    catch {
        return null
    }
}

/**
 * The user of the log line: the id, `-` without the header, `invalid` for a value that is no positive integer. The
 * raw value of such a header is not logged: it can be anything, line breaks too.
 */
function userForLog(userId: string | null | undefined): string {
    if (userId === undefined) {
        return '-'
    }
    return userId === null || parseUserIdHeader(userId) === undefined ? 'invalid' : userId
}

/** ` [<correlation id>]` for a safe id, a fixed word for any other, nothing without the header. */
function correlationSuffix(context: KafkaContext): string {
    const correlationId = headerText(context, 'kafka_correlationId')
    if (correlationId === undefined || correlationId === '') {
        return ''
    }
    return correlationId !== null && SAFE_CORRELATION_ID.test(correlationId) ? ` [${correlationId}]` : ' [invalid correlation id]'
}
