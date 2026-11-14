import { Injectable } from '@nestjs/common'
import { EpicSvtTestSetupConfig, EpicSvtTestSetupConfigBody } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestSetupConfigs } from 'epic-api-types/kafka'

import { SvtDbSvtTestSetupConfigEntity, SvtDbSvtTestSetupConfigsRepository, SvtDbSvtTestSetupsRepository } from '../../../db/data'
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

import { SvtDbAgentNextSvtTestSetupConfigCreateDto } from './svt-db-agent-next-svt-test-setup-configs.dtos'


import MessageType = SvtDbAgentKafkaSvtTestSetupConfigs.MessageType


/**
 * `GetAllSvtTestSetupConfigs`, `CreateSvtTestSetupConfig`, `GetSvtTestSetupConfigBody`
 * (`DbAgent/docs/05-request-handlers.md` §12). The body is a JSON string kept verbatim; lists never carry
 * it; an unknown id is `NotFound` (Q-H20, the C++ replied Success with an empty entity).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextSvtTestSetupConfigsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly configs: SvtDbSvtTestSetupConfigsRepository,
        private readonly setups: SvtDbSvtTestSetupsRepository,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            {
                type: MessageType.GetAllSvtTestSetupConfigs,
                replyType: MessageType.GetAllSvtTestSetupConfigsReply,
                handle: (data) => this.getAll(data),
            },
            {
                type: MessageType.CreateSvtTestSetupConfig,
                replyType: MessageType.CreateSvtTestSetupConfigReply,
                handle: (data) => this.create(data),
            },
            {
                type: MessageType.GetSvtTestSetupConfigBody,
                replyType: MessageType.GetSvtTestSetupConfigBodyReply,
                handle: (data) => this.getBody(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestSetupConfig>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids', 'setupId'])
        const items = await this.configs.findAll({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            setupId: optionalInteger(filter['setupId'], 'data.filter.setupId'),
        })
        return { items: items.map(toWire), totalCount: items.length }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafkaSvtTestSetupConfigs.CreateSvtTestSetupConfigReplyMessageData> {
        const create = validateRequestData(SvtDbAgentNextSvtTestSetupConfigCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        if (!(await this.setups.findById(create.setupId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Test setup ${create.setupId} does not exist`)
        }
        parseJsonOrBadRequest(create.configBody, 'data.create.configBody')

        const config = await this.configs.create({
            setupId: create.setupId,
            name: create.name,
            configBody: create.configBody,
            note: create.note ?? null,
        })
        return { entity: toWire(config) }
    }

    private async getBody(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<EpicSvtTestSetupConfigBody>> {
        const id = requireInteger(requireRecord(data, 'data')['id'], 'data.id')
        const configBody = await this.configs.findBody(id)
        if (configBody === null) {
            throw SvtDbAgentNextRequestError.notFound(`Test setup config ${id} not found`)
        }
        return { entity: { id, configBody } }
    }

}

function toWire(config: SvtDbSvtTestSetupConfigEntity): EpicSvtTestSetupConfig {
    return {
        id: config.id,
        setupId: config.setup.id,
        name: config.name,
        note: config.note,
        createdAt: config.createdAt,
    }
}
