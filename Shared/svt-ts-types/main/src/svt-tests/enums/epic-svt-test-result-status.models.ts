/**
 * The physical result status of an SVT test, as the DB agent stores it: the values of the PostgreSQL enum
 * `testResultStatus` (also the vocabulary of the test agents' run logs; `CANCELLED` added for the UI). A test
 * that has not finished has **no** result status: `null` on the wire, never a value of this enum. The status
 * the UI shows is `EpicSvtTestStatus`, derived from it by the API.
 */
export enum EpicSvtTestResultStatus {
    Success = 'SUCCESS',
    PartialSuccess = 'PARTIAL_SUCCESS',
    Failure = 'FAILURE',
    Error = 'ERROR',
    Cancelled = 'CANCELLED',
}
