import { Injectable } from '@nestjs/common'
import { EpicSvtTestTypeConfig, EpicSvtTestTypeConfigBody } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestTypeConfigs } from 'epic-api-types/kafka'
import { SvtDbSvtTestTypeConfigEntity, SvtDbSvtTestTypeConfigsRepository, SvtDbSvtTestTypesRepository } from 'svt-db/data'

import {
    optionalInteger,
    optionalIntegerList,
    optionalRecord,
    parseJsonOrBadRequest,
    requireAllowedFilterKeys,
    requireInteger,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'

import { SvtDbAgentNextSvtTestTypeConfigCreateDto } from './svt-db-agent-next-svt-test-type-configs.dtos'


import MessageType = SvtDbAgentKafkaSvtTestTypeConfigs.MessageType


/**
 * `GetAllSvtTestTypeConfigs`, `CreateSvtTestTypeConfig`, `GetSvtTestTypeConfigBody`
 * (`DbAgent/docs/05-request-handlers.md` §12). The body is a JSON string kept verbatim; lists never carry
 * it; an unknown id is `NotFound` (Q-H20). A config name is unique per test type (database index).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextSvtTestTypeConfigsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly configs: SvtDbSvtTestTypeConfigsRepository,
        private readonly testTypes: SvtDbSvtTestTypesRepository,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            {
                type: MessageType.GetAllSvtTestTypeConfigs,
                replyType: MessageType.GetAllSvtTestTypeConfigsReply,
                handle: (data) => this.getAll(data),
            },
            {
                type: MessageType.CreateSvtTestTypeConfig,
                replyType: MessageType.CreateSvtTestTypeConfigReply,
                handle: (data) => this.create(data),
            },
            {
                type: MessageType.GetSvtTestTypeConfigBody,
                replyType: MessageType.GetSvtTestTypeConfigBodyReply,
                handle: (data) => this.getBody(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestTypeConfig>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids', 'testTypeId'])
        const items = await this.configs.findAll({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            testTypeId: optionalInteger(filter['testTypeId'], 'data.filter.testTypeId'),
        })
        return { items: items.map(toWire), totalCount: items.length }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafkaSvtTestTypeConfigs.CreateSvtTestTypeConfigReplyMessageData> {
        const create = validateRequestData(SvtDbAgentNextSvtTestTypeConfigCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        if (!(await this.testTypes.findById(create.testTypeId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Test type ${create.testTypeId} does not exist`)
        }
        parseJsonOrBadRequest(create.configBody, 'data.create.configBody')

        const config = await this.configs.create({
            testTypeId: create.testTypeId,
            name: create.name,
            configBody: create.configBody,
            note: create.note ?? null,
        })
        return { entity: toWire(config) }
    }

    private async getBody(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestTypeConfigBody>> {
        const id = requireInteger(requireRecord(data, 'data')['id'], 'data.id')
        const configBody = await this.configs.findBody(id)
        if (configBody === null) {
            throw SvtDbAgentNextRequestError.notFound(`Test type config ${id} not found`)
        }
        return { entity: { id, configBody } }
    }

}

function toWire(config: SvtDbSvtTestTypeConfigEntity): EpicSvtTestTypeConfig {
    return {
        id: config.id,
        testTypeId: config.testType.id,
        name: config.name,
        note: config.note,
        createdAt: config.createdAt,
    }
}
