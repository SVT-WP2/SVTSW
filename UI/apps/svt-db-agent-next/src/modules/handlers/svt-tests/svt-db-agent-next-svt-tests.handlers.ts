import { Injectable, Logger } from '@nestjs/common'
import { EpicSvtTestCreateDto, EpicSvtTestEntity, SvtDbAgentKafka, SvtDbAgentKafkaSvtTests } from 'epic/entities'
import {
    SvtDbAsicsRepository,
    SvtDbChipBlocksRepository,
    SvtDbChipsRepository,
    SvtDbEnumsService,
    SvtDbSvtTestSetupConfigsRepository,
    SvtDbSvtTestsRepository,
    SvtDbSvtTestTypeConfigsRepository,
    SvtDbSvtTestWithDut,
} from 'svt-db/data'

import {
    optionalDateTime,
    optionalInteger,
    optionalIntegerList,
    optionalPager,
    optionalRecord,
    optionalStringList,
    requireAllowedFilterKeys,
    requireInteger,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'

import { SvtDbAgentNextSvtTestFinishDto, SvtDbAgentNextSvtTestStartDto } from './svt-db-agent-next-svt-tests.dtos'


import MessageType = SvtDbAgentKafkaSvtTests.MessageType


/**
 * The two messages TestAgent sends when a test runs (`svt.db-agent.kafka.yaml`); `epic/entities` has no class
 * for them yet, so their names live here.
 */
export const SVT_DB_AGENT_NEXT_UPDATE_SVT_TEST_START = 'UpdateSvtTestStart'
export const SVT_DB_AGENT_NEXT_UPDATE_SVT_TEST_FINISH = 'UpdateSvtTestFinish'

const FILTER_KEYS = [
    'ids', 'dutEntityNames', 'dutId', 'testResultStatuses', 'testTypeConfigIds', 'testSetupConfigIds',
    'createdAtFrom', 'createdAtTo', 'startedAtFrom', 'startedAtTo', 'finishedAtFrom', 'finishedAtTo',
] as const

/**
 * `GetAllSvtTests`, `CreateSvtTest`, `UpdateSvtTestStart`, `UpdateSvtTestFinish`
 * (`DbAgent/docs/05-request-handlers.md` §15). Every contract filter works (Q-H12: the C++ had `ids` only);
 * timestamps travel as ISO 8601 UTC (R-6); the test's device must exist; the state machine is not enforced
 * (TestAgent drives it), out-of-order transitions are logged.
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextSvtTestsHandlers implements SvtDbAgentNextMessageHandlers {

    private readonly logger = new Logger(SvtDbAgentNextSvtTestsHandlers.name)

    constructor(
        private readonly tests: SvtDbSvtTestsRepository,
        private readonly typeConfigs: SvtDbSvtTestTypeConfigsRepository,
        private readonly setupConfigs: SvtDbSvtTestSetupConfigsRepository,
        private readonly asics: SvtDbAsicsRepository,
        private readonly chips: SvtDbChipsRepository,
        private readonly chipBlocks: SvtDbChipBlocksRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllSvtTests, replyType: MessageType.GetAllSvtTestsReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateSvtTest, replyType: MessageType.CreateSvtTestReply, handle: (data) => this.create(data) },
            {
                type: SVT_DB_AGENT_NEXT_UPDATE_SVT_TEST_START,
                replyType: `${SVT_DB_AGENT_NEXT_UPDATE_SVT_TEST_START}Reply`,
                handle: (data) => this.updateStart(data),
            },
            {
                type: SVT_DB_AGENT_NEXT_UPDATE_SVT_TEST_FINISH,
                replyType: `${SVT_DB_AGENT_NEXT_UPDATE_SVT_TEST_FINISH}Reply`,
                handle: (data) => this.updateFinish(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestEntity>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, FILTER_KEYS)
        const pager = optionalPager(body['pager'], 'data.pager')

        const page = await this.tests.findPage({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            dutEntityNames: optionalStringList(filter['dutEntityNames'], 'data.filter.dutEntityNames'),
            dutId: optionalInteger(filter['dutId'], 'data.filter.dutId'),
            testResultStatuses: optionalStringList(filter['testResultStatuses'], 'data.filter.testResultStatuses'),
            testTypeConfigIds: optionalIntegerList(filter['testTypeConfigIds'], 'data.filter.testTypeConfigIds'),
            testSetupConfigIds: optionalIntegerList(filter['testSetupConfigIds'], 'data.filter.testSetupConfigIds'),
            createdAtFrom: optionalDateTime(filter['createdAtFrom'], 'data.filter.createdAtFrom'),
            createdAtTo: optionalDateTime(filter['createdAtTo'], 'data.filter.createdAtTo'),
            startedAtFrom: optionalDateTime(filter['startedAtFrom'], 'data.filter.startedAtFrom'),
            startedAtTo: optionalDateTime(filter['startedAtTo'], 'data.filter.startedAtTo'),
            finishedAtFrom: optionalDateTime(filter['finishedAtFrom'], 'data.filter.finishedAtFrom'),
            finishedAtTo: optionalDateTime(filter['finishedAtTo'], 'data.filter.finishedAtTo'),
        }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    /** `data.create = { dutEntityName, dutId, testTypeConfigId, testSetupConfigId }`; the device and both configs must exist. */
    private async create(data: unknown): Promise<SvtDbAgentKafkaSvtTests.CreateSvtTestReplyMessageData> {
        const create = validateRequestData(EpicSvtTestCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        await this.assertDutExists(create.dutEntityName, create.dutId)
        if (!(await this.typeConfigs.findById(create.testTypeConfigId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Test type config ${create.testTypeConfigId} does not exist`)
        }
        if (!(await this.setupConfigs.findById(create.testSetupConfigId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Test setup config ${create.testSetupConfigId} does not exist`)
        }

        const created = await this.tests.create({
            dutEntityName: create.dutEntityName,
            dutId: create.dutId,
            testTypeConfigId: create.testTypeConfigId,
            testSetupConfigId: create.testSetupConfigId,
        })
        return { entity: toWire(created) }
    }

    /** `data.id` + `data.update.startedAt`. */
    private async updateStart(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestEntity>> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = validateRequestData(SvtDbAgentNextSvtTestStartDto, body['update'], 'data.update')

        const current = await this.requireTest(id)
        if (current.test.startedAt) {
            this.logger.warn(`Test ${id} was already started at ${current.test.startedAt.toISOString()}; overwriting`)
        }
        const updated = await this.tests.update(id, { startedAt: new Date(update.startedAt) })
        return { entity: toWire(updated) }
    }

    /** `data.id` + `data.update.{ finishedAt, pathToResult, testResultStatus }`. */
    private async updateFinish(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestEntity>> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = validateRequestData(SvtDbAgentNextSvtTestFinishDto, body['update'], 'data.update')
        const statuses = await this.enums.getValues('testResultStatus')
        if (!statuses.includes(update.testResultStatus)) {
            throw SvtDbAgentNextRequestError.badRequest(`${update.testResultStatus} is not a value of the testResultStatus enum`)
        }

        const current = await this.requireTest(id)
        if (!current.test.startedAt) {
            this.logger.warn(`Test ${id} is finished without having been started`)
        }
        if (current.test.finishedAt) {
            this.logger.warn(`Test ${id} was already finished at ${current.test.finishedAt.toISOString()}; overwriting`)
        }
        const updated = await this.tests.update(id, {
            finishedAt: new Date(update.finishedAt),
            pathToResult: update.pathToResult,
            testResultStatus: update.testResultStatus,
        })
        return { entity: toWire(updated) }
    }

    private async requireTest(id: number): Promise<SvtDbSvtTestWithDut> {
        const test = await this.tests.findById(id)
        if (!test) {
            throw SvtDbAgentNextRequestError.notFound(`Test ${id} not found`)
        }
        return test
    }

    /** The device under test: a row of the table the entity name denotes (no foreign key can enforce it). */
    private async assertDutExists(dutEntityName: string, dutId: number): Promise<void> {
        const names = await this.enums.getValues('dutEntityName')
        if (!names.includes(dutEntityName)) {
            throw SvtDbAgentNextRequestError.badRequest(`${dutEntityName} is not a value of the dutEntityName enum`)
        }
        const exists = dutEntityName === 'Asic'
            ? (await this.asics.findByIds([dutId])).length > 0
            : dutEntityName === 'Chip'
                ? (await this.chips.findById(dutId)) !== null
                : (await this.chipBlocks.findById(dutId)) !== null
        if (!exists) {
            throw SvtDbAgentNextRequestError.badRequest(`${dutEntityName} ${dutId} does not exist`)
        }
    }

}

function toWire({ test, dutEntityName, dutId }: SvtDbSvtTestWithDut): EpicSvtTestEntity {
    return {
        id: test.id,
        dutEntityName,
        dutId,
        testTypeConfigId: test.testTypeConfig.id,
        testSetupConfigId: test.testSetupConfig.id,
        createdAt: toIso(test.createdAt),
        startedAt: toIso(test.startedAt),
        finishedAt: toIso(test.finishedAt),
        pathToResult: test.pathToResult,
        testResultStatus: test.testResultStatus,
    } as EpicSvtTestEntity
}

function toIso(date: Date | null): string | null {
    return date ? date.toISOString() : null
}
