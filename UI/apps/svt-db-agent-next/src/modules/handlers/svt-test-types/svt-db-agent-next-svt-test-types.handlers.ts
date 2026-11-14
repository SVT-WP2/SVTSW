import { Injectable } from '@nestjs/common'
import { EpicSvtTestType } from 'epic-api-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaSvtTestTypes } from 'epic-api-types/kafka'

import { SvtDbEnumsService, SvtDbSvtTestTypesRepository, SvtDbSvtTestTypeWithDutTypes } from '../../../db/data'
import {
    optionalIntegerList,
    optionalRecord,
    optionalStringList,
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

import { SvtDbAgentNextSvtTestTypeCreateDto, SvtDbAgentNextSvtTestTypeUpdateDto } from './svt-db-agent-next-svt-test-types.dtos'


import MessageType = SvtDbAgentKafkaSvtTestTypes.MessageType


/**
 * `GetAllSvtTestTypes`, `CreateSvtTestType`, `UpdateSvtTestType` (`DbAgent/docs/05-request-handlers.md` §13).
 * The `dutTypes` filter works (D-4, Q-H9 fixed: a type matches when it has any of them); a type without
 * DUT types lists `dutTypes: []` (R-4); `UpdateSvtTestType` takes the contract shape `data.id` +
 * `data.update.dutTypes` and **replaces** the list (D-1; the C++ read another shape and only appended).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextSvtTestTypesHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly testTypes: SvtDbSvtTestTypesRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllSvtTestTypes, replyType: MessageType.GetAllSvtTestTypesReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateSvtTestType, replyType: MessageType.CreateSvtTestTypeReply, handle: (data) => this.create(data) },
            { type: MessageType.UpdateSvtTestType, replyType: MessageType.UpdateSvtTestTypeReply, handle: (data) => this.update(data) },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestType>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids', 'dutTypes'])
        const items = await this.testTypes.findAll({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            dutTypes: optionalStringList(filter['dutTypes'], 'data.filter.dutTypes'),
        })
        return { items: items.map(toWire), totalCount: items.length }
    }

    /** `data.create = { name, dutTypes, testTypeConfig: { name, configBody, note? } }`, one transaction. */
    private async create(data: unknown): Promise<SvtDbAgentKafkaSvtTestTypes.CreateSvtTestTypeReplyMessageData> {
        const create = validateRequestData(SvtDbAgentNextSvtTestTypeCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        // `@ValidateNested()` alone lets a missing object through.
        if (!create.testTypeConfig) {
            throw SvtDbAgentNextRequestError.badRequest('data.create.testTypeConfig is required')
        }
        await this.assertDutTypes(create.dutTypes)
        parseJsonOrBadRequest(create.testTypeConfig.configBody, 'data.create.testTypeConfig.configBody')

        const created = await this.testTypes.createWithConfig({
            name: create.name,
            dutTypes: create.dutTypes,
            config: {
                name: create.testTypeConfig.name,
                configBody: create.testTypeConfig.configBody,
                note: create.testTypeConfig.note ?? null,
            },
        })
        return { entity: toWire(created) }
    }

    /** `data.id` + `data.update.dutTypes`: the list sent becomes the type's DUT types. */
    private async update(data: unknown): Promise<SvtDbAgentKafkaSvtTestTypes.UpdateSvtTestTypeReplyMessageData> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = validateRequestData(SvtDbAgentNextSvtTestTypeUpdateDto, body['update'], 'data.update')
        await this.assertDutTypes(update.dutTypes)

        const updated = await this.testTypes.replaceDutTypes(id, update.dutTypes)
        if (!updated) {
            throw SvtDbAgentNextRequestError.notFound(`Test type ${id} not found`)
        }
        return { entity: toWire(updated) }
    }

    private async assertDutTypes(values: string[]): Promise<void> {
        const allowed = await this.enums.getValues('dutType')
        const unknown = values.find((value) => !allowed.includes(value))
        if (unknown !== undefined) {
            throw SvtDbAgentNextRequestError.badRequest(`${unknown} is not a value of the dutType enum`)
        }
    }

}

function toWire({ testType, dutTypes }: SvtDbSvtTestTypeWithDutTypes): EpicSvtTestType {
    return { id: testType.id, name: testType.name, dutTypes }
}
