import { EpicDateTimeString } from '../../common'
import { EpicSvtDutEntityName, EpicSvtTestResultStatus, EpicSvtTestStatus } from '../enums'


/**
 * An SVT test as the `/api/svt-tests` endpoints return it. The DB agent stores everything but `status`, which
 * the API derives from `testResultStatus` before handing the test to the UI. Timestamps are ISO 8601 UTC;
 * `startedAt`, `finishedAt`, `pathToResult` and `testResultStatus` are `null` until the test reaches that step.
 */
export type EpicSvtTest = {
    id: number
    dutEntityName: EpicSvtDutEntityName
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
    createdAt: EpicDateTimeString
    startedAt: EpicDateTimeString | null
    finishedAt: EpicDateTimeString | null
    pathToResult: string | null
    /** Physical, stored in the DB; `null` while the test has no result yet. */
    testResultStatus: EpicSvtTestResultStatus | null
    /** Synthetic, derived by the API — the one the UI shows. */
    status: EpicSvtTestStatus
}
