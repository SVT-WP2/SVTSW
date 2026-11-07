import { EpicDateTimeString } from '../../common'
import { EpicSvtDutEntityName, EpicSvtTestResultStatus, EpicSvtTestStatus } from '../enums'


/**
 * An SVT test as the `/api/svt-tests` endpoints return it. The DB agent stores everything but `status`, which
 * the API derives from `testResultStatus` before handing the test to the UI.
 */
export type EpicSvtTest = {
    id: number
    dutEntityName: EpicSvtDutEntityName
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
    createdAt: EpicDateTimeString
    startedAt: EpicDateTimeString
    finishedAt: EpicDateTimeString
    pathToResult: string
    /** Physical, stored in the DB. */
    testResultStatus: EpicSvtTestResultStatus
    /** Synthetic, derived by the API — the one the UI shows. */
    status: EpicSvtTestStatus
}
