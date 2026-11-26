import { EpicKafkaReplyStatus } from 'svt-ts-types/kafka'


/** The reply text for a value that a unique constraint refuses (`docs/messages.md` §1.4). */
export const SVT_DB_AGENT_NEXT_UNIQUE_VIOLATION_MESSAGE = 'Failed entry creation: an entry with the same unique value already exists'

/**
 * A failure the dispatcher turns into a reply envelope (`status`, `error: { code, message }`). Handlers throw
 * it for validation (`BadRequest`) and missing ids (`NotFound`); anything else they let escape becomes
 * `UnexpectedError` with a generic message (never SQL, never stack traces).
 * `code` stays `-1` until the contract defines error codes (01-behaviour-decisions §2).
 */
export class SvtDbAgentNextRequestError extends Error {

    constructor(readonly status: EpicKafkaReplyStatus, message: string, readonly code = -1) {
        super(message)
        this.name = 'SvtDbAgentNextRequestError'
    }

    static badRequest(message: string): SvtDbAgentNextRequestError {
        return new SvtDbAgentNextRequestError(EpicKafkaReplyStatus.BadRequest, message)
    }

    static notFound(message: string): SvtDbAgentNextRequestError {
        return new SvtDbAgentNextRequestError(EpicKafkaReplyStatus.NotFound, message)
    }

}
