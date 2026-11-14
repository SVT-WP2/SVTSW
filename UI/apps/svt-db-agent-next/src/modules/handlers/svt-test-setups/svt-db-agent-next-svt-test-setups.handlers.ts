import { Injectable } from '@nestjs/common'
import { EpicSvtTestSetupCreateDto, EpicSvtTestSetupUpdateDto, SvtDbAgentKafka, SvtDbAgentKafkaSvtTestSetups } from 'epic/entities'
import { EpicSvtTestSetup } from 'epic-api-types'
import {
    SvtDbEnumsService,
    SvtDbSvtTestSetupConfigsRepository,
    SvtDbSvtTestSetupsRepository,
    SvtDbSvtTestSetupWithDefault,
} from 'svt-db/data'

import {
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


import MessageType = SvtDbAgentKafkaSvtTestSetups.MessageType


/**
 * `GetAllSvtTestSetups`, `CreateSvtTestSetup`, `UpdateSvtTestSetup` (`DbAgent/docs/05-request-handlers.md`
 * §11). A setup without a default-config row lists with `defaultConfigId: null` (Q-R2); `UpdateSvtTestSetup`
 * creates the row when it is missing (Q-U1) and only accepts a config of that setup (Q20: the author confirmed
 * that the default config, which the TestAgent loads for the setup, must belong to it).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextSvtTestSetupsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly setups: SvtDbSvtTestSetupsRepository,
        private readonly configs: SvtDbSvtTestSetupConfigsRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllSvtTestSetups, replyType: MessageType.GetAllSvtTestSetupsReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateSvtTestSetup, replyType: MessageType.CreateSvtTestSetupReply, handle: (data) => this.create(data) },
            { type: MessageType.UpdateSvtTestSetup, replyType: MessageType.UpdateSvtTestSetupReply, handle: (data) => this.update(data) },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicSvtTestSetup>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const items = await this.setups.findAll({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') })
        return { items: items.map(toWire), totalCount: items.length }
    }

    /** `data.create = { name, generalLocation, defaultConfig: { name, configBody, note? } }`, one transaction. */
    private async create(data: unknown): Promise<SvtDbAgentKafkaSvtTestSetups.CreateSvtTestSetupReplyMessageData> {
        const create = validateRequestData(EpicSvtTestSetupCreateDto, requireRecord(data, 'data')['create'], 'data.create')
        // `@ValidateNested()` alone lets a missing object through.
        if (!create.defaultConfig) {
            throw SvtDbAgentNextRequestError.badRequest('data.create.defaultConfig is required')
        }
        await this.assertGeneralLocation(create.generalLocation)
        parseJsonOrBadRequest(create.defaultConfig.configBody, 'data.create.defaultConfig.configBody')

        const created = await this.setups.createWithDefaultConfig({
            name: create.name,
            generalLocation: create.generalLocation,
            defaultConfig: {
                name: create.defaultConfig.name,
                configBody: create.defaultConfig.configBody,
                note: create.defaultConfig.note ?? null,
            },
        })
        return { entity: toWire(created) }
    }

    /** `data.id` + `data.update.defaultConfigId`: the config must exist and belong to the setup (Q20). */
    private async update(data: unknown): Promise<SvtDbAgentKafkaSvtTestSetups.UpdateSvtTestSetupReplyMessageData> {
        const body = requireRecord(data, 'data')
        const id = requireInteger(body['id'], 'data.id')
        const update = validateRequestData(EpicSvtTestSetupUpdateDto, body['update'], 'data.update')

        if (!(await this.setups.findById(id))) {
            throw SvtDbAgentNextRequestError.notFound(`Test setup ${id} not found`)
        }
        const config = await this.configs.findById(update.defaultConfigId)
        if (!config) {
            throw SvtDbAgentNextRequestError.badRequest(`Test setup config ${update.defaultConfigId} does not exist`)
        }
        if (config.setup.id !== id) {
            throw SvtDbAgentNextRequestError.badRequest(`Test setup config ${config.id} does not belong to test setup ${id}`)
        }

        const updated = await this.setups.setDefaultConfig(id, config.id)
        return { entity: toWire(updated) }
    }

    private async assertGeneralLocation(value: string): Promise<void> {
        const values = await this.enums.getValues('wpGeneralLocation')
        if (!values.includes(value)) {
            throw SvtDbAgentNextRequestError.badRequest(`${value} is not a value of the wpGeneralLocation enum`)
        }
    }

}

function toWire({ setup, defaultConfigId }: SvtDbSvtTestSetupWithDefault): EpicSvtTestSetup {
    return {
        id: setup.id,
        name: setup.name,
        defaultConfigId,
        generalLocation: setup.generalLocation,
    }
}
