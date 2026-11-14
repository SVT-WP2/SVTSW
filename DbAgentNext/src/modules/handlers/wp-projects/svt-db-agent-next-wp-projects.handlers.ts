import { Injectable } from '@nestjs/common'
import { EpicWpProject } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWpProjects } from 'svt-ts-types/kafka'

import {
    SvtDbEnumsService,
    SvtDbWaferTypesRepository,
    SvtDbWpMachinesRepository,
    SvtDbWpProjectEntity,
    SvtDbWpProjectsRepository,
} from '../../../db/data'
import {
    optionalIntegerList,
    optionalPager,
    jsonTextOrBadRequest,
    optionalRecord,
    requireAllowedFilterKeys,
    requireRecord,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
    SvtDbAgentNextRequestError,
    validateRequestData,
} from '../../dispatch'

import { SvtDbAgentNextWpProjectCreateDto } from './svt-db-agent-next-wp-projects.dtos'


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

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicWpProject>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const pager = optionalPager(body['pager'], 'data.pager')
        const page = await this.projects.findPage({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    private async create(data: unknown): Promise<SvtDbAgentKafka.OneEntityReplyMessageData<EpicWpProject>> {
        const create = validateRequestData(SvtDbAgentNextWpProjectCreateDto, requireRecord(data, 'data')['create'], 'data.create')

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
            local2GlobalMap: jsonTextOrBadRequest(create.local2GlobalMap, 'data.create.local2GlobalMap'),
        })
        return { entity: toWire(project) }
    }

}

function toWire(project: SvtDbWpProjectEntity): EpicWpProject {
    return {
        id: project.id,
        wpMachineId: project.wpMachine.id,
        waferTypeId: project.waferType.id,
        name: project.name,
        asicFamilyType: project.asicFamilyType,
        orientation: project.orientation,
        alignmentDie: project.alignmentDie,
        homeDie: project.homeDie,
        local2GlobalMap: project.local2GlobalMap,
    }
}
