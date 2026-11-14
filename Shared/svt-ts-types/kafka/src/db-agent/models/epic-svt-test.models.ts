import { EpicDateTimeString, EpicSvtTest, EpicSvtTestResultStatus } from 'epic-api-types'


/**
 * An SVT test as the DB agent stores and serves it over Kafka: every field of the HTTP contract type except the
 * synthetic `status`, which the BFF derives (see `resolveEpicSvtTestStatus`) before handing the test to the UI.
 */
export type EpicSvtTestEntity = Omit<EpicSvtTest, 'status'>
/**
 * `data.update` of the `UpdateSvtTestStart` Kafka message, sent by the test agent when a test starts running.
 * Kafka only: no HTTP endpoint exposes it.
 */
export type EpicSvtTestStartUpdate = {
    /** ISO 8601 date-time. */
    startedAt: EpicDateTimeString
}
/**
 * `data.update` of the `UpdateSvtTestFinish` Kafka message, sent by the test agent when a test has run.
 * Kafka only: no HTTP endpoint exposes it.
 */
export type EpicSvtTestFinishUpdate = {
    /** ISO 8601 date-time. */
    finishedAt: EpicDateTimeString
    pathToResult: string
    testResultStatus: EpicSvtTestResultStatus
}
