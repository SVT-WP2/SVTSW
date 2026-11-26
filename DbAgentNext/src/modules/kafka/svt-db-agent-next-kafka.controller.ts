import { Controller, Logger } from '@nestjs/common'
import { Ctx, KafkaContext, MessagePattern, Payload } from '@nestjs/microservices'
import { EpicKafkaReplyStatus, SvtDbAgentKafka, SvtKafkaHeader } from 'svt-ts-types/kafka'

import { isRecord, parseUserIdHeader, SvtDbAgentNextReply, SvtDbAgentNextRequestDispatcher } from '../dispatch'


/**
 * The Kafka side of the agent: one method for every record of `svt.db-agent.request`. The payload goes to
 * the dispatcher as the e2e harness sends it, and the returned **string** becomes the value of the reply
 * record (NestJS adds `kafka_correlationId` and `kafka_replyPartition` from the request headers and sends it
 * to the request's `kafka_replyTopic`). Nothing is ever thrown out of here: an exception would become a
 * `kafka_nest-err` header the clients do not understand.
 *
 * It reads the header `svt_userId` of the record and hands its raw value to the dispatcher, which checks it. The
 * reply does not repeat the header. The log line of each request names the user (`user=42`, `user=-`).
 */
@Controller()
export class SvtDbAgentNextKafkaController {

    private readonly logger = new Logger(SvtDbAgentNextKafkaController.name)

    constructor(private readonly dispatcher: SvtDbAgentNextRequestDispatcher) {
    }

    @MessagePattern(SvtDbAgentKafka.TopicName.Request)
    async handleRequest(@Payload() value: unknown, @Ctx() context: KafkaContext): Promise<string> {
        const startedAt = Date.now()
        const requestType = isRecord(value) && typeof value['type'] === 'string' ? value['type'] : '<no type>'
        const userId = headerValue(context, SvtKafkaHeader.UserId)
        let reply: SvtDbAgentNextReply
        try {
            reply = await this.dispatcher.dispatch(value, { userId })
        }
        catch (error) {
            // The dispatcher answers every failure itself; this is the last line of defence.
            this.logger.error(`${requestType}: the dispatcher threw`, error instanceof Error ? error.stack : String(error))
            reply = {
                type: `${requestType}Reply`,
                status: EpicKafkaReplyStatus.UnexpectedError,
                data: null,
                error: { code: -1, message: `Unexpected error while processing ${requestType}` },
            }
        }
        this.logger.log(
            `${requestType} → ${reply.status} in ${Date.now() - startedAt} ms user=${userForLog(userId)}${correlationSuffix(context)}`,
        )
        return JSON.stringify(reply)
    }

}

/**
 * The value of one header of the record, decoded as UTF-8; `undefined` when the record has no such header. A header
 * that the record has more than once gives its values joined by commas, which no check of a header accepts.
 */
function headerValue(context: KafkaContext, name: string): string | undefined {
    const raw = context.getMessage()?.headers?.[name]
    if (raw === undefined || raw === null) {
        return undefined
    }
    const values = Array.isArray(raw) ? raw : [raw]
    return values.map((item) => (Buffer.isBuffer(item) ? item.toString('utf8') : String(item))).join(',')
}

/**
 * The user of the log line: the id, `-` without the header, `invalid` for a value that the dispatcher refuses. The
 * raw value of a refused header is not logged: it can be anything, line breaks too.
 */
function userForLog(userId: string | undefined): string {
    if (userId === undefined) {
        return '-'
    }
    return parseUserIdHeader(userId) === undefined ? 'invalid' : userId
}

function correlationSuffix(context: KafkaContext): string {
    const correlationId = headerValue(context, 'kafka_correlationId')
    return correlationId ? ` [${correlationId}]` : ''
}
