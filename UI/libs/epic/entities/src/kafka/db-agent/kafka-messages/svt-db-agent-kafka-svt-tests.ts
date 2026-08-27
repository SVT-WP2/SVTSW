import { EpicDateTimeString, EpicPager } from '../../../common'
import { EpicSvtTestCreateEntity, EpicSvtTestEntity } from '../../../svt-tests'
import { EpicKafkaMessageClass, EpicKafkaReplyMessageClass } from '../../common'

import { SvtDbAgentKafka } from './svt-db-agent-kafka'


export namespace SvtDbAgentKafkaSvtTests {

    export enum MessageType {
        GetAllSvtTests = 'GetAllSvtTests',
        GetAllSvtTestsReply = 'GetAllSvtTestsReply',
        CreateSvtTest = 'CreateSvtTest',
        CreateSvtTestReply = 'CreateSvtTestReply',
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
        /** Enum values of `EpicSvtTestResultStatus`. */
        testResultStatuses?: string[]
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
        pager?: EpicPager
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
        create: EpicSvtTestCreateEntity
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

    export type RequestMessage =
        | GetAllSvtTestsMessage
        | CreateSvtTestMessage

    export type ReplyMessage =
        | GetAllSvtTestsReplyMessage
        | CreateSvtTestReplyMessage

    export type Message =
        | RequestMessage
        | ReplyMessage

}

