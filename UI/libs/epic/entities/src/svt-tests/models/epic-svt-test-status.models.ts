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

/**
 * The other direction of `resolveEpicSvtTestStatus`, used to turn a filter written in the synthetic vocabulary
 * into the physical one the DB agent stores: which `testResultStatus` values can currently resolve to any of
 * the requested statuses.
 *
 * `Running` has no counterpart — no stored value resolves to it today, so asking only for Running matches
 * nothing. Once the live processing state of the other services is folded into `status`, this is the place
 * that has to learn about it, together with `resolveEpicSvtTestStatus`.
 */
export function resolveEpicSvtTestResultStatuses(statuses: EpicSvtTestStatus[]): EpicSvtTestResultStatus[] {
    const testResultStatuses = new Set<EpicSvtTestResultStatus>()

    statuses.forEach((status) => {
        switch (status) {
            case EpicSvtTestStatus.Pending:
                testResultStatuses.add(EpicSvtTestResultStatus.None)
                break
            case EpicSvtTestStatus.Completed:
                testResultStatuses.add(EpicSvtTestResultStatus.Completed)
                break
            case EpicSvtTestStatus.Failed:
                testResultStatuses.add(EpicSvtTestResultStatus.Failed)
                break
            case EpicSvtTestStatus.Cancelled:
                testResultStatuses.add(EpicSvtTestResultStatus.Cancelled)
                break
            case EpicSvtTestStatus.Running:
                // nothing stored resolves to Running yet — see the note above
                break
        }
    })

    return Array.from(testResultStatuses)
}
