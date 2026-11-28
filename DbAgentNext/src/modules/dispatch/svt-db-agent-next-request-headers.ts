/**
 * The headers of a request record that the dispatcher reads. The Kafka controller gives the text of each header; the
 * e2e harness passes the values as they are, so a spec can send a malformed value.
 */
export type SvtDbAgentNextRequestHeaders = {
    /**
     * The header `svt_userId`: its text; `null` when the record has the header but no text in it (a null value, or a
     * value that NestJS has already parsed as JSON); absent when the record has no such header. The check refuses
     * `null`: only a record without the header is a request without a user.
     */
    userId?: string | null
}

/** A positive decimal integer: no sign, no space, no leading zero, at most 10 digits. */
const USER_ID_PATTERN = /^[1-9][0-9]{0,9}$/

/** The largest value of a PostgreSQL `integer`, the type of `SvtUser.id`. */
const MAX_USER_ID = 2147483647

/**
 * The user id of a value of the header `svt_userId`, or `undefined` when the value is no decimal string of a
 * positive integer of the range of `SvtUser.id` (`docs/messages.md` §1.5).
 */
export function parseUserIdHeader(value: string): number | undefined {
    if (!USER_ID_PATTERN.test(value)) {
        return undefined
    }
    const userId = Number(value)
    return userId <= MAX_USER_ID ? userId : undefined
}
