import { Injectable } from '@nestjs/common'
import { SvtDbAgentKafka, SvtDbAgentKafkaChipBlocks } from 'epic/entities'
import { EpicChipBlock } from 'epic-api-types'
import { SvtDbChipBlockEntity, SvtDbChipBlocksRepository } from 'svt-db/data'

import {
    optionalInteger,
    optionalIntegerList,
    optionalPager,
    optionalRecord,
    optionalString,
    optionalStringList,
    requireAllowedFilterKeys,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
} from '../../dispatch'


import MessageType = SvtDbAgentKafkaChipBlocks.MessageType


const FILTER_KEYS = ['ids', 'chipId', 'chipBlockTypes', 'serialNumber'] as const

/**
 * `GetAllBlocks` (the contract's `GetAllChipBlocks` message, which the C++ agent never implemented:
 * `01-behaviour-decisions.md` §1). The wire name of the `blockType` column is `chipBlockType` (R-11).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextChipBlocksHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(private readonly chipBlocks: SvtDbChipBlocksRepository) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllChipBlocks, replyType: MessageType.GetAllChipBlocksReply, handle: (data) => this.getAll(data) },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicChipBlock>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, FILTER_KEYS)
        const pager = optionalPager(body['pager'], 'data.pager')

        const page = await this.chipBlocks.findPage({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            chipId: optionalInteger(filter['chipId'], 'data.filter.chipId'),
            chipBlockTypes: optionalStringList(filter['chipBlockTypes'], 'data.filter.chipBlockTypes'),
            serialNumber: optionalString(filter['serialNumber'], 'data.filter.serialNumber'),
        }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

}

function toWire(block: SvtDbChipBlockEntity): EpicChipBlock {
    return {
        id: block.id,
        chipId: block.chip.id,
        chipBlockType: block.blockType,
        serialNumber: block.serialNumber,
    }
}
