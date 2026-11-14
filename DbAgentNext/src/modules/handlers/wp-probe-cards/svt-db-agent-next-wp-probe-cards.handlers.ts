import { Injectable } from '@nestjs/common'
import { EpicWpProbeCard } from 'svt-ts-types'
import { SvtDbAgentKafka, SvtDbAgentKafkaWpProbeCards } from 'svt-ts-types/kafka'

import { SvtDbWpProbeCardsRepository, SvtDbWpProbeCardWithFamilyTypes } from '../../../db/data'
import {
    optionalIntegerList,
    optionalRecord,
    requireAllowedFilterKeys,
    SvtDbAgentNextHandlerDefinition,
    SvtDbAgentNextHandlers,
    SvtDbAgentNextMessageHandlers,
} from '../../dispatch'


import MessageType = SvtDbAgentKafkaWpProbeCards.MessageType


/** `ProbeCardDto` of the Kafka contract: the TypeScript `EpicWpProbeCard` plus `asicFamilyTypes` (R-3). */
export type SvtDbAgentNextWpProbeCardWire = EpicWpProbeCard & {
    asicFamilyTypes: string[]
}

/**
 * `GetAllProbeCards` (`DbAgent/docs/05-request-handlers.md` §8). Items carry the `asicFamilyTypes` of
 * `ProbeCardFamilyType`, which the C++ left out (Q-H15). The contract has no write message for probe cards.
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextWpProbeCardsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(private readonly probeCards: SvtDbWpProbeCardsRepository) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllWpProbeCards, replyType: MessageType.GetAllWpProbeCardsReply, handle: (data) => this.getAll(data) },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<SvtDbAgentNextWpProbeCardWire>> {
        const filter = optionalRecord(optionalRecord(data, 'data')['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, ['ids'])
        const items = await this.probeCards.findAll({ ids: optionalIntegerList(filter['ids'], 'data.filter.ids') })
        return { items: items.map(toWire), totalCount: items.length }
    }

}

function toWire({ probeCard, asicFamilyTypes }: SvtDbWpProbeCardWithFamilyTypes): SvtDbAgentNextWpProbeCardWire {
    return {
        id: probeCard.id,
        serialNumber: probeCard.serialNumber,
        name: probeCard.name,
        vendor: probeCard.vendor,
        model: probeCard.model,
        arriveDate: probeCard.arriveDate,
        location: probeCard.location,
        type: probeCard.type,
        vendorCleaningInterval: probeCard.vendorCleaningInterval,
        asicFamilyTypes,
    }
}
