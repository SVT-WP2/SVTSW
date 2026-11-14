import { Injectable } from '@nestjs/common'
import { SvtDbAgentKafkaEnums } from 'svt-ts-types/kafka'

import { SvtDbEnumsService } from '../../../db/data'
import {
    optionalRecord,
    optionalStringList,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
} from '../../dispatch'


import MessageType = SvtDbAgentKafkaEnums.MessageType

/**
 * `GetAllEnums`: the live enum values of the database, `{ [enumType]: string[] }` with no wrapper.
 * The names to return may come as `data.filter.enumNames` (contract), `data.enumNames` or `data.enumsNames`
 * (what the clients send, 01-behaviour-decisions §3); absent means every enum type.
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextEnumsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(private readonly enums: SvtDbEnumsService) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllEnums, replyType: MessageType.GetAllEnumsReply, handle: (data) => this.getAll(data) },
        ]
    }

    private getAll(data: unknown): Promise<Record<string, string[]>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        const names = optionalStringList(filter['enumNames'], 'data.filter.enumNames')
            ?? optionalStringList(body['enumNames'], 'data.enumNames')
            ?? optionalStringList(body['enumsNames'], 'data.enumsNames')
        // An empty list means every enum type, as for every other list filter of the contract (the BFF sends
        // `enumNames: []` when the UI asks for all of them).
        return this.enums.getAll(names?.length ? names : undefined)
    }

}
