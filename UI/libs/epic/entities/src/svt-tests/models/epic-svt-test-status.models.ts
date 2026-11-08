import { EpicSvtTestResultStatus, EpicSvtTestStatus } from 'epic-api-types'


/**
 * `status` is synthetic — it is not stored in the DB, it is derived on the BE from the physical
 * `testResultStatus` (and, in a later step, from the live processing state reported by other services).
 *
 * - testResultStatus === null  => the test has no result yet, so it is Pending. Later, once a processing
 *   service reports the test is being executed, this is where null turns into Running.
 * - SUCCESS and PARTIAL_SUCCESS => Completed; FAILURE and ERROR => Failed; CANCELLED => Cancelled.
 */
export function resolveEpicSvtTestStatus(testResultStatus: EpicSvtTestResultStatus | null): EpicSvtTestStatus {
    switch (testResultStatus) {
        case EpicSvtTestResultStatus.Success:
        case EpicSvtTestResultStatus.PartialSuccess:
            return EpicSvtTestStatus.Completed
        case EpicSvtTestResultStatus.Failure:
        case EpicSvtTestResultStatus.Error:
            return EpicSvtTestStatus.Failed
        case EpicSvtTestResultStatus.Cancelled:
            return EpicSvtTestStatus.Cancelled
        default:
            return EpicSvtTestStatus.Pending
    }
}

/**
 * The other direction of `resolveEpicSvtTestStatus`, used to turn a filter written in the synthetic vocabulary
 * into the physical one the DB agent stores: which `testResultStatus` values can currently resolve to any of
 * the requested statuses. `null` in the result selects the tests without a result yet (Pending).
 *
 * `Running` has no counterpart — no stored value resolves to it today, so asking only for Running matches
 * nothing. Once the live processing state of the other services is folded into `status`, this is the place
 * that has to learn about it, together with `resolveEpicSvtTestStatus`.
 */
export function resolveEpicSvtTestResultStatuses(statuses: EpicSvtTestStatus[]): (EpicSvtTestResultStatus | null)[] {
    const testResultStatuses = new Set<EpicSvtTestResultStatus | null>()

    statuses.forEach((status) => {
        switch (status) {
            case EpicSvtTestStatus.Pending:
                testResultStatuses.add(null)
                break
            case EpicSvtTestStatus.Completed:
                testResultStatuses.add(EpicSvtTestResultStatus.Success)
                testResultStatuses.add(EpicSvtTestResultStatus.PartialSuccess)
                break
            case EpicSvtTestStatus.Failed:
                testResultStatuses.add(EpicSvtTestResultStatus.Failure)
                testResultStatuses.add(EpicSvtTestResultStatus.Error)
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
