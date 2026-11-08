import { Injectable } from '@nestjs/common'
import {
    EpicWaferTypeCreateRequestDto,
    EpicWaferTypeEntity,
    EpicWaferTypeMapEntity,
    SvtDbAgentKafka,
    SvtDbAgentKafkaWaferTypes,
} from 'epic/entities'
import { SvtDbEnumsService, SvtDbWaferTypeEntity, SvtDbWaferTypesRepository, validateWaferMap } from 'svt-db/data'

import {
    optionalIntegerList,
    optionalRecord,
    requireInteger,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'


import MessageType = SvtDbAgentKafkaWaferTypes.MessageType

/**
 * `GetAllWaferTypes`, `CreateWaferType`, `GetWaferTypeMap` (`DbAgent/docs/05-request-handlers.md` §2,
 * decisions in `docs/db-agent-clone/01-behaviour-decisions.md`).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextWaferTypesHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly waferTypes: SvtDbWaferTypesRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllWaferTypes, replyType: MessageType.GetAllWaferTypesReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateWaferType, replyType: MessageType.CreateWaferTypeReply, handle: (data) => this.create(data) },
            { type: MessageType.GetWaferTypeMap, replyType: MessageType.GetWaferTypeMapReply, handle: (data) => this.getMap(data) },
        ]
    }

    /** `data.filter.ids` is the only filter the C++ declares; absent means all. */
    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicWaferTypeEntity>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        const ids = optionalIntegerList(filter['ids'], 'data.filter.ids')
        const items = await this.waferTypes.findAll({ ids })
        return { items: items.map(toWire), totalCount: items.length }
    }

    /**
     * Contract shape: `data.create` with the wafer map as a JSON string inside it. The C++ also demanded a
     * top-level `data.waferMap` key (D-7); it is tolerated and ignored here.
     */
    private async create(data: unknown): Promise<SvtDbAgentKafkaWaferTypes.CreateWaferTypeReplyMessageData> {
        const body = requireRecord(data, 'data')
        const create = validateRequestData(EpicWaferTypeCreateRequestDto, body['create'], 'data.create')

        const enums = await this.enums.getAll(['asicFamilyType', 'engineeringRun', 'foundryName', 'waferTech'])
        assertEnumValue(enums['engineeringRun'], create.engineeringRun, 'engineeringRun')
        assertEnumValue(enums['foundryName'], create.foundry, 'foundryName')
        assertEnumValue(enums['waferTech'], create.technology, 'waferTech')

        const validation = validateWaferMap(create.waferMap, enums['asicFamilyType'] ?? [])
        // Equality, not truthiness: the app's tsconfig is not `strict`, and only equality narrows the union there.
        if (validation.valid === false) {
            throw SvtDbAgentNextRequestError.badRequest(validation.errors.join('\n'))
        }

        const entity = await this.waferTypes.create(
            { name: create.name, engineeringRun: create.engineeringRun, foundry: create.foundry, technology: create.technology },
            validation.map,
        )
        return { entity: toWire(entity) }
    }

    private async getMap(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<EpicWaferTypeMapEntity>> {
        const waferTypeId = requireInteger(requireRecord(data, 'data')['waferTypeId'], 'data.waferTypeId')
        const map = await this.waferTypes.findMap(waferTypeId)
        if (!map) {
            throw SvtDbAgentNextRequestError.notFound(`No wafer map for wafer type ${waferTypeId}`)
        }
        return { entity: { waferMap: JSON.stringify(map.waferMap) } }
    }

}

function toWire(entity: SvtDbWaferTypeEntity): EpicWaferTypeEntity {
    return {
        id: entity.id,
        name: entity.name,
        engineeringRun: entity.engineeringRun,
        foundry: entity.foundry,
        technology: entity.technology,
    }
}

function assertEnumValue(values: string[] | undefined, value: string, enumName: string): void {
    if (!values?.includes(value)) {
        throw SvtDbAgentNextRequestError.badRequest(`${value} is not a value of the ${enumName} enum`)
    }
}
