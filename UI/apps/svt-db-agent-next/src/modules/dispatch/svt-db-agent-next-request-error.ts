import { EpicKafkaReplyStatus } from 'epic-api-types/kafka'


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
