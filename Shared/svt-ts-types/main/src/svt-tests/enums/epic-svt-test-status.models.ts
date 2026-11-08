/**
 * The status the UI shows for an SVT test. It is synthetic — derived by the API from the stored
 * `EpicSvtTestResultStatus` (and, later, from the live processing state the other services report), never
 * stored itself.
 */
export enum EpicSvtTestStatus {
    Pending = 'Pending',
    Running = 'Running',
    Completed = 'Completed',
    Failed = 'Failed',
    Cancelled = 'Cancelled',
}
