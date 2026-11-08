import { Controller, Logger } from '@nestjs/common'
import { Ctx, KafkaContext, MessagePattern, Payload } from '@nestjs/microservices'
import { EpicKafkaReplyStatus, SvtDbAgentKafka } from 'epic/entities'

import { isRecord, SvtDbAgentNextReply, SvtDbAgentNextRequestDispatcher } from '../dispatch'


/**
 * The Kafka side of the agent: one method for every record of `svt.db-agent.request`. The payload goes to
 * the dispatcher as the e2e harness sends it, and the returned **string** becomes the value of the reply
 * record (NestJS adds `kafka_correlationId` and `kafka_replyPartition` from the request headers and sends it
 * to the request's `kafka_replyTopic`). Nothing is ever thrown out of here: an exception would become a
 * `kafka_nest-err` header the clients do not understand.
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
        let reply: SvtDbAgentNextReply
        try {
            reply = await this.dispatcher.dispatch(value)
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
        this.logger.log(`${requestType} → ${reply.status} in ${Date.now() - startedAt} ms${correlationSuffix(context)}`)
        return JSON.stringify(reply)
    }

}

function correlationSuffix(context: KafkaContext): string {
    const header = context.getMessage()?.headers?.['kafka_correlationId']
    const correlationId = Buffer.isBuffer(header) ? header.toString() : typeof header === 'string' ? header : undefined
    return correlationId ? ` [${correlationId}]` : ''
}
