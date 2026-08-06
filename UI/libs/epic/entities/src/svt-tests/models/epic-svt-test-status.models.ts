import { EpicSvtTestResultStatus } from './epic-svt-test-result-status.models'


export enum EpicSvtTestStatus {
    Pending = 'Pending',
    Running = 'Running',
    Completed = 'Completed',
    Failed = 'Failed',
    Cancelled = 'Cancelled',
}

/**
 * `status` is synthetic — it is not stored in the DB, it is derived on the BE from the physical
 * `testResultStatus` (and, in a later step, from the live processing state reported by other services).
 *
 * - testResultStatus === None  => the test has no result yet, so it is Pending. Later, once a processing
 *   service reports the test is being executed, this is where None turns into Running.
 * - testResultStatus !== None  => the result is final and the status mirrors it one-to-one.
 */
export function resolveEpicSvtTestStatus(testResultStatus: EpicSvtTestResultStatus): EpicSvtTestStatus {
    switch (testResultStatus) {
        case EpicSvtTestResultStatus.None:
            return EpicSvtTestStatus.Pending
        case EpicSvtTestResultStatus.Completed:
            return EpicSvtTestStatus.Completed
        case EpicSvtTestResultStatus.Failed:
            return EpicSvtTestStatus.Failed
        case EpicSvtTestResultStatus.Cancelled:
            return EpicSvtTestStatus.Cancelled
    }
}
