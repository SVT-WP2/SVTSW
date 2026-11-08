import { Injectable } from '@nestjs/common'
import { EpicWpProjectCreateDto, EpicWpProjectEntity, SvtDbAgentKafka, SvtDbAgentKafkaWpProjects } from 'epic/entities'
import {
    SvtDbEnumsService,
    SvtDbWaferTypesRepository,
    SvtDbWpMachinesRepository,
    SvtDbWpProjectEntity,
    SvtDbWpProjectsRepository,
} from 'svt-db/data'

import {
    optionalIntegerList,
    optionalRecord,
    parseJsonOrBadRequest,
    requireAllowedFilterKeys,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'


import MessageType = SvtDbAgentKafkaWpProjects.MessageType


/**
 * `GetAllWaferProbeProjects` and `CreateWaferProbeProject` (`DbAgent/docs/05-request-handlers.md` §9).
 * `local2GlobalMap` travels as a JSON string (R-7): the request must carry a string holding valid JSON (an
 * object is a `BadRequest`, where the C++ silently stored NULL), the reply re-serialises the stored JSON.
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextWpProjectsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly projects: SvtDbWpProjectsRepository,
        private readonly machines: SvtDbWpMachinesRepository,
        private readonly waferTypes: SvtDbWaferTypesRepository,
        private readonly enums: SvtDbEnumsService,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllWpProjects, replyType: MessageType.GetAllWpProjectsReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateWpProject, replyType: MessageType.CreateWpProjectReply, handle: (data) => this.create(data) },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicWpProjectEntity>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const items = await this.projects.findAll({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') })
        return { items: items.map(toWire), totalCount: items.length }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<EpicWpProjectEntity>> {
        const create = validateRequestData(EpicWpProjectCreateDto, requireRecord(data, 'data')['create'], 'data.create')

        const enums = await this.enums.getAll(['asicFamilyType', 'waferMapOrientation'])
        if (!enums['asicFamilyType']?.includes(create.asicFamilyType)) {
            throw SvtDbAgentNextRequestError.badRequest(`${create.asicFamilyType} is not a value of the asicFamilyType enum`)
        }
        if (!enums['waferMapOrientation']?.includes(create.orientation)) {
            throw SvtDbAgentNextRequestError.badRequest(`${create.orientation} is not a value of the waferMapOrientation enum`)
        }
        if (!(await this.machines.findById(create.wpMachineId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Wafer probe machine ${create.wpMachineId} does not exist`)
        }
        if (!(await this.waferTypes.findById(create.waferTypeId))) {
            throw SvtDbAgentNextRequestError.badRequest(`Wafer type ${create.waferTypeId} does not exist`)
        }

        const project = await this.projects.create({
            wpMachineId: create.wpMachineId,
            waferTypeId: create.waferTypeId,
            name: create.name,
            asicFamilyType: create.asicFamilyType,
            orientation: create.orientation,
            alignmentDie: create.alignmentDie,
            homeDie: create.homeDie,
            local2GlobalMap: parseJsonOrBadRequest(create.local2GlobalMap, 'data.create.local2GlobalMap'),
        })
        return { entity: toWire(project) }
    }

}

function toWire(project: SvtDbWpProjectEntity): EpicWpProjectEntity {
    return {
        id: project.id,
        wpMachineId: project.wpMachine.id,
        waferTypeId: project.waferType.id,
        name: project.name,
        asicFamilyType: project.asicFamilyType,
        orientation: project.orientation,
        alignmentDie: project.alignmentDie,
        homeDie: project.homeDie,
        local2GlobalMap: project.local2GlobalMap === null ? null : JSON.stringify(project.local2GlobalMap),
    }
}
