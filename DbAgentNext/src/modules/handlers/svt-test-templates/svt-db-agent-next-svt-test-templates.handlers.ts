import { Injectable } from '@nestjs/common'
import { EpicSvtTestTemplate } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestTemplates } from 'svt-ts-types/kafka'

import {
    SvtDbEnumsService,
    SvtDbSvtTestTemplatesRepository,
    SvtDbSvtTestTemplateWithTestType,
    SvtDbSvtTestTypeConfigsRepository,
} from '../../../db/data'
import {
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

import { SvtDbAgentNextSvtTestTemplateCreateDto, SvtDbAgentNextSvtTestTemplateUpdateDto } from './svt-db-agent-next-svt-test-templates.dtos'


import MessageType = SvtDbAgentKafkaSvtTestTemplates.MessageType


/**
 * `GetAllSvtTestTemplates`, `CreateSvtTestTemplate`, `UpdateSvtTestTemplate` (`DbAgent/docs/05-request-handlers.md`
 * §14). `isEnabled` is honoured on create (D-12, Q-H17: the C++ dropped it); `testTypeId` comes from the
 * template's configuration; a DUT type + configuration pair is unique (database index).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextSvtTestTemplatesHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly templates: SvtDbSvtTestTemplatesRepository,
        private readonly configs: SvtDbSvtTestTypeConfigsRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            {
                type: MessageType.GetAllSvtTestTemplates,
                replyType: MessageType.GetAllSvtTestTemplatesReply,
                handle: (data) => this.getAll(data),
            },
            {
                type: MessageType.CreateSvtTestTemplate,
                replyType: MessageType.CreateSvtTestTemplateReply,
                handle: (data) => this.create(data),
            },
            {
                type: MessageType.UpdateSvtTestTemplate,
                replyType: MessageType.UpdateSvtTestTemplateReply,
                handle: (data) => this.update(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestTemplate>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids', 'dutTypes'])
        const pager = optionalPager(body['pager'], 'data.pager')
        const page = await this.templates.findPage({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            dutTypes: optionalStringList(filter['dutTypes'], 'data.filter.dutTypes'),
        }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafkaSvtTestTemplates.CreateSvtTestTemplateReplyMessageData> {
        const create = validateRequestData(SvtDbAgentNextSvtTestTemplateCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        const dutTypes = await this.enums.getValues('dutType')
        if (!dutTypes.includes(create.dutType)) {
            throw SvtDbAgentNextRequestError.badRequest(`${create.dutType} is not a value of the dutType enum`)
        }
        if (!(await this.configs.findById(create.testTypeConfigId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Test type config ${create.testTypeConfigId} does not exist`)
        }

        const created = await this.templates.create({
            dutType: create.dutType,
            testTypeConfigId: create.testTypeConfigId,
            isEnabled: create.isEnabled,
        })
        return { entity: toWire(created) }
    }

    /** `data.id` + `data.update.isEnabled`. */
    private async update(data: unknown): Promise<SvtDbAgentKafkaSvtTestTemplates.UpdateSvtTestTemplateReplyMessageData> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = validateRequestData(SvtDbAgentNextSvtTestTemplateUpdateDto, body['update'], 'data.update')

        const updated = await this.templates.update(id, { isEnabled: update.isEnabled })
        if (!updated) {
            throw SvtDbAgentNextRequestError.notFound(`Test template ${id} not found`)
        }
        return { entity: toWire(updated) }
    }

}

function toWire({ template, testTypeId }: SvtDbSvtTestTemplateWithTestType): EpicSvtTestTemplate {
    return {
        id: template.id,
        dutType: template.dutType,
        // The column is nullable with default true; a NULL (never written by the agent) reads as the default.
        isEnabled: template.isEnabled ?? true,
        testTypeId,
        testTypeConfigId: template.testTypeConfig.id,
    }
}
