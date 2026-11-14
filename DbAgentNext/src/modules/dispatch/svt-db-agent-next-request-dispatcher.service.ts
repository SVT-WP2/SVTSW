import { DriverException, MikroORM, RequestContext, UniqueConstraintViolationException } from '@mikro-orm/core'
import { Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { DiscoveryService } from '@nestjs/core'
import { EpicKafkaReplyError, EpicKafkaReplyStatus } from 'svt-ts-types/kafka'

import { SvtDbAgentNextHandlerDefinition, SvtDbAgentNextHandlers, SvtDbAgentNextMessageHandlers } from './svt-db-agent-next-handler.models'
import { SvtDbAgentNextRequestError } from './svt-db-agent-next-request-error'
import { isRecord } from './svt-db-agent-next-request-validation'


/**
 * Postgres SQLSTATE `invalid_text_representation`: a value that cannot be read as its column's type, such as an
 * enum value that does not exist.
 */
const INVALID_TEXT_REPRESENTATION = '22P02'

/** The reply envelope as it goes on the wire: `data` is `null` on failure, `error` is always present. */
export type SvtDbAgentNextReply<TData = Record<string, any>> = {
    type: string
    status: EpicKafkaReplyStatus
    data: TData | null
    error: EpicKafkaReplyError
}

/**
 * Routes a request envelope `{ type, data }` to its handler and always answers with a reply envelope
 * `{ type, status, data, error }`, whatever happens (an exception leaving the Kafka handler would become a
 * `kafka_nest-err` header the clients do not understand). Every handler runs in its own MikroORM request
 * context, so the global `EntityManager` can be injected everywhere.
 *
 * The Kafka controller (phase 4) and the e2e harness call `dispatch` with the same payload, so an e2e test
 * exercises exactly what a Kafka message exercises, minus the transport.
 */
@Injectable()
export class SvtDbAgentNextRequestDispatcher implements OnModuleInit {

    private readonly logger = new Logger(SvtDbAgentNextRequestDispatcher.name)
    private readonly handlers = new Map<string, SvtDbAgentNextHandlerDefinition>()

    constructor(
        private readonly discovery: DiscoveryService,
        private readonly orm: MikroORM,
    ) {
    }

    get registeredTypes(): string[] {
        return [...this.handlers.keys()].sort()
    }

    onModuleInit(): void {
        for (const wrapper of this.discovery.getProviders({ metadataKey: SvtDbAgentNextHandlers.KEY })) {
            const instance = wrapper.instance as Partial<SvtDbAgentNextMessageHandlers> | undefined
            if (typeof instance?.getHandlerDefinitions !== 'function') {
                continue
            }
            for (const definition of instance.getHandlerDefinitions()) {
                if (this.handlers.has(definition.type)) {
                    throw new Error(`Two handlers registered for message type ${definition.type}`)
                }
                this.handlers.set(definition.type, definition)
            }
        }
        this.logger.log(`${this.handlers.size} message handlers registered`)
    }

    async dispatch(message: unknown): Promise<SvtDbAgentNextReply> {
        const request = isRecord(message) ? message : {}
        const type = typeof request['type'] === 'string' ? request['type'] : undefined
        if (!type) {
            return failure('UnknownRequestReply', EpicKafkaReplyStatus.BadRequest, 'Malformed request: missing string "type"')
        }
        const definition = this.handlers.get(type)
        if (!definition) {
            return failure(`${type}Reply`, EpicKafkaReplyStatus.BadRequest, `Unknown request type: ${type}`)
        }

        try {
            const data = await RequestContext.create(this.orm.em, () => definition.handle(request['data'] ?? {}))
            return {
                type: definition.replyType,
                status: EpicKafkaReplyStatus.Success,
                data: data as Record<string, any>,
                error: { code: 0, message: '' },
            }
        }
        catch (error) {
            return this.failureFor(definition.replyType, type, error)
        }
    }

    private failureFor(replyType: string, requestType: string, error: unknown): SvtDbAgentNextReply {
        if (error instanceof SvtDbAgentNextRequestError) {
            return failure(replyType, error.status, error.message, error.code)
        }
        if (error instanceof UniqueConstraintViolationException) {
            this.logger.warn(`${requestType}: unique constraint violated`)
            return failure(
                replyType,
                EpicKafkaReplyStatus.BadRequest,
                'Failed entry creation: an entry with the same unique value already exists',
            )
        }
        if (error instanceof DriverException && error.code === INVALID_TEXT_REPRESENTATION) {
            this.logger.warn(`${requestType}: ${error.message}`)
            return failure(replyType, EpicKafkaReplyStatus.BadRequest, describeInvalidTextRepresentation(error.message))
        }
        this.logger.error(`${requestType} failed`, error instanceof Error ? error.stack : String(error))
        return failure(replyType, EpicKafkaReplyStatus.UnexpectedError, `Unexpected error while processing ${requestType}`)
    }

}

function failure(type: string, status: EpicKafkaReplyStatus, message: string, code = -1): SvtDbAgentNextReply {
    return { type, status, data: null, error: { code, message } }
}

/**
 * The reply message for a Postgres `22P02`: the one the handlers meet is a filter value that is no value of its
 * enum type (`invalid input value for enum main."asicFamilyType": "ChipBlock"`); anything else gets a generic
 * line, the database's own message stays in the log.
 */
function describeInvalidTextRepresentation(message: string): string {
    const match = /invalid input value for enum (?:\w+\.)?"?(\w+)"?: "([^"]*)"/.exec(message)
    return match
        ? `Error: "${match[2]}" is not a value of the ${match[1]} enum`
        : 'Error: a value does not fit the type of its column'
}
