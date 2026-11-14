import { EpicApiPager, EpicDateTimeString, EpicSvtTestCreateRequest, EpicSvtTestResultStatus } from 'svt-ts-types'

import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'
import { EpicSvtTestEntity, EpicSvtTestFinishUpdate, EpicSvtTestStartUpdate } from '../models'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaSvtTests {

    export enum MessageType {
        GetAllSvtTests = 'GetAllSvtTests',
        GetAllSvtTestsReply = 'GetAllSvtTestsReply',
        CreateSvtTest = 'CreateSvtTest',
        CreateSvtTestReply = 'CreateSvtTestReply',
        UpdateSvtTestStart = 'UpdateSvtTestStart',
        UpdateSvtTestStartReply = 'UpdateSvtTestStartReply',
        UpdateSvtTestFinish = 'UpdateSvtTestFinish',
        UpdateSvtTestFinishReply = 'UpdateSvtTestFinishReply',
    }

    // GET ALL

    /**
     * The filter exactly as `svt.db-agent.kafka.yaml` defines it — the DB vocabulary, spelled out rather than
     * derived from the API filter so the two layers stay free to diverge. `testResultStatuses` holds the
     * physically stored values, unlike the synthetic `statuses` the API exposes.
     */
    export type GetAllSvtTestsFilter = {
        ids?: number[]
        dutEntityNames?: string[]
        /** DUT ids are unique per DUT entity only, so it is meant to be combined with `dutEntityNames`. */
        dutId?: number
        /** Stored result statuses; `null` in the list selects the tests without a result yet. */
        testResultStatuses?: (EpicSvtTestResultStatus | null)[]
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

    export type GetAllSvtTestsData = {
        filter?: GetAllSvtTestsFilter
        pager?: EpicApiPager
    }

    export class GetAllSvtTestsMessage extends EpicKafkaMessageClass<GetAllSvtTestsData> {

        readonly type = MessageType.GetAllSvtTests

    }

    export type GetAllSvtTestsReplyMessageData = SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestEntity>

    export class GetAllSvtTestsReplyMessage extends EpicKafkaReplyMessageClass<GetAllSvtTestsReplyMessageData> {

        readonly type = MessageType.GetAllSvtTestsReply

    }

    // CREATE

    export type CreateSvtTestMessageData = {
        create: EpicSvtTestCreateRequest
    }

    export class CreateSvtTestMessage extends EpicKafkaMessageClass<CreateSvtTestMessageData> {

        readonly type = MessageType.CreateSvtTest

    }

    export type CreateSvtTestReplyMessageData = {
        entity: EpicSvtTestEntity
    }

    export class CreateSvtTestReplyMessage extends EpicKafkaReplyMessageClass<CreateSvtTestReplyMessageData> {

        readonly type = MessageType.CreateSvtTestReply

    }

    // UPDATE START (sent by the test agent when a test starts running)

    export type UpdateSvtTestStartMessageData = {
        id: number
        update: EpicSvtTestStartUpdate
    }

    export class UpdateSvtTestStartMessage extends EpicKafkaMessageClass<UpdateSvtTestStartMessageData> {

        readonly type = MessageType.UpdateSvtTestStart

    }

    export type UpdateSvtTestStartReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestEntity>

    export class UpdateSvtTestStartReplyMessage extends EpicKafkaReplyMessageClass<UpdateSvtTestStartReplyMessageData> {

        readonly type = MessageType.UpdateSvtTestStartReply

    }

    // UPDATE FINISH (sent by the test agent when a test has run)

    export type UpdateSvtTestFinishMessageData = {
        id: number
        update: EpicSvtTestFinishUpdate
    }

    export class UpdateSvtTestFinishMessage extends EpicKafkaMessageClass<UpdateSvtTestFinishMessageData> {

        readonly type = MessageType.UpdateSvtTestFinish

    }

    export type UpdateSvtTestFinishReplyMessageData = SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestEntity>

    export class UpdateSvtTestFinishReplyMessage extends EpicKafkaReplyMessageClass<UpdateSvtTestFinishReplyMessageData> {

        readonly type = MessageType.UpdateSvtTestFinishReply

    }

    export type RequestMessage =
        | GetAllSvtTestsMessage
        | CreateSvtTestMessage
        | UpdateSvtTestStartMessage
        | UpdateSvtTestFinishMessage

    export type ReplyMessage =
        | GetAllSvtTestsReplyMessage
        | CreateSvtTestReplyMessage
        | UpdateSvtTestStartReplyMessage
        | UpdateSvtTestFinishReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}
