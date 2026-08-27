import { EpicDateTimeString } from 'epic/entities'

import { EpicSvtTestResultStatus } from './epic-svt-test-result-status.models'
import { EpicSvtTestStatus } from './epic-svt-test-status.models'


export enum EpicSvtDutEntityName {
    Asic = 'Asic',
    Chip = 'Chip',
    ChipBlock = 'ChipBlock',
}

export type EpicSvtTestEntity = {
    id: number
    dutEntityName: EpicSvtDutEntityName
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
    createdAt: EpicDateTimeString
    startedAt: EpicDateTimeString
    finishedAt: EpicDateTimeString
    pathToResult: string
    testResultStatus: EpicSvtTestResultStatus
}

/**
 * `EpicSvtTestEntity` as returned by the DB agent carries only physically-stored fields. The BFF enriches it
 * with the synthetic `status` (see resolveEpicSvtTestStatus) before handing it to the UI.
 */
export type EpicSvtTestResolvedEntity = EpicSvtTestEntity & {
    status: EpicSvtTestStatus
}

export type EpicSvtTestCreateEntity = {
    dutEntityName: EpicSvtDutEntityName
    dutId: number
    testTypeConfigId: number
    testSetupConfigId: number
}

/**
 * The SvtTests list filter as the API exposes it. It is deliberately *not* the Kafka filter: the API speaks in
 * the synthetic `status` the UI shows in the list, and `EpicSvtTestsService` translates that into the physical
 * `testResultStatuses` the DB agent stores (see `SvtDbAgentKafkaSvtTests.GetAllSvtTestsFilter`). Every member
 * is optional — an omitted / empty one means "do not narrow the list down by it".
 */
export type EpicSvtTestsGetAllParams = {
    ids?: number[]
    dutEntityNames?: string[]
    /** DUT ids are unique per DUT entity only, so it is meant to be combined with `dutEntityNames`. */
    dutId?: number
    /** Enum values of `EpicSvtTestStatus` — the status the UI shows, not the stored result status. */
    statuses?: string[]
    testTypeConfigIds?: number[]
    testSetupConfigIds?: number[]
    /** Lower bound of the `createdAt` filter range, inclusive. */
    createdAtFrom?: EpicDateTimeString
    /** Upper bound of the `createdAt` filter range, exclusive. */
    createdAtTo?: EpicDateTimeString
    /** Lower bound of the `startedAt` filter range, inclusive. */
    startedAtFrom?: EpicDateTimeString
    /** Upper bound of the `startedAt` filter range, exclusive. */
    startedAtTo?: EpicDateTimeString
    /** Lower bound of the `finishedAt` filter range, inclusive. */
    finishedAtFrom?: EpicDateTimeString
    /** Upper bound of the `finishedAt` filter range, exclusive. */
    finishedAtTo?: EpicDateTimeString
}
