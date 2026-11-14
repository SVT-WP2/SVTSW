import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EpicChipCreateManyRequestDto, EpicChipCreateRequestDto, SvtDbAgentKafka, SvtDbAgentKafkaChips } from 'epic/entities'
import { EpicChip, EpicChipLocationHistoryRecord } from 'epic-api-types'
import {
    SvtDbAsicsRepository,
    SvtDbChipCreateInput,
    SvtDbChipCreateOptions,
    SvtDbChipLocationEntity,
    SvtDbChipsRepository,
    SvtDbChipWithFamilyType,
    SvtDbEnumsService,
} from 'svt-db/data'

import { SvtDbAgentNextConfig } from '../../../config'
import {
    optionalIntegerList,
    optionalPager,
    optionalRecord,
    optionalString,
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

import { SvtDbAgentNextChipLocationRecordDto } from './svt-db-agent-next-chips.dtos'


import MessageType = SvtDbAgentKafkaChips.MessageType


const FILTER_KEYS = ['ids', 'generalLocation', 'serialNumber', 'familyTypes'] as const

/** One item of `CreateChip` or `CreateManyChips` before the ASIC is resolved. */
type ChipItem = {
    serialNumber: string
    asicId: number
}

/**
 * `GetAllChips`, `CreateChip`, `CreateManyChips`, `UpdateChipLocation`, `GetChipLocationHistory`
 * (`DbAgent/docs/05-request-handlers.md` §1 and §5, decisions in `docs/db-agent-clone/01-behaviour-decisions.md`).
 *
 * Items carry the `familyType` of the chip's ASIC and the `familyTypes` filter works (D-5, Q-H3 fixed);
 * `CreateManyChips` replies with the chips it created (R-2) and tolerates the extra `data.items` key (D-8).
 * One chip per ASIC: a second chip for the same ASIC is a `BadRequest`. Chip blocks are written only with
 * `SVT_DB_AGENT_FEATURE_CHIP_BLOCKS` on (Q6, unconfirmed naming).
 */
@Injectable()
@SvtDbAgentNextHandlers()
export class SvtDbAgentNextChipsHandlers implements SvtDbAgentNextMessageHandlers {

    constructor(
        private readonly chips: SvtDbChipsRepository,
        private readonly asics: SvtDbAsicsRepository,
        private readonly enums: SvtDbEnumsService,
        private readonly configService: ConfigService<SvtDbAgentNextConfig, true>,
    ) {
    }

    getHandlerDefinitions(): SvtDbAgentNextHandlerDefinition<unknown, unknown>[] {
        return [
            { type: MessageType.GetAllChips, replyType: MessageType.GetAllChipsReply, handle: (data) => this.getAll(data) },
            { type: MessageType.CreateChip, replyType: MessageType.CreateChipReply, handle: (data) => this.create(data) },
            { type: MessageType.CreateManyChips, replyType: MessageType.CreateManyChipsReply, handle: (data) => this.createMany(data) },
            {
                type: MessageType.UpdateChipLocation,
                replyType: MessageType.UpdateChipLocationReply,
                handle: (data) => this.updateLocation(data),
            },
            {
                type: MessageType.GetChipLocationHistory,
                replyType: MessageType.GetChipLocationHistoryReply,
                handle: (data) => this.getLocationHistory(data),
            },
        ]
    }

    private async getAll(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicChip>> {
        const body = optionalRecord(data, 'data')
        const filter = optionalRecord(body['filter'], 'data.filter')
        requireAllowedFilterKeys(filter, FILTER_KEYS)
        const pager = optionalPager(body['pager'], 'data.pager')

        const page = await this.chips.findPage({
            ids: optionalIntegerList(filter['ids'], 'data.filter.ids'),
            generalLocation: optionalString(filter['generalLocation'], 'data.filter.generalLocation'),
            serialNumber: optionalString(filter['serialNumber'], 'data.filter.serialNumber'),
            familyTypes: optionalStringList(filter['familyTypes'], 'data.filter.familyTypes'),
        }, pager)
        return { items: page.items.map(toWire), totalCount: page.totalCount }
    }

    /** `data.create`: the chip, its first location row and (feature on) its blocks, in one transaction. */
    private async create(data: unknown): Promise<SvtDbAgentKafkaChips.CreateChipReplyMessageData> {
        const body = requireRecord(data, 'data')
        const create = validateRequestData(EpicChipCreateRequestDto, body['create'], 'data.create')
        await this.assertGeneralLocation(create.generalLocation)

        const [input] = await this.toCreateInputs([create], create.generalLocation, 'data.create')
        const created = await this.chips.create(input, this.createOptions())
        return { entity: toWire(created) }
    }

    /**
     * `data.create = { generalLocation, items }`: every item at the same location, all or nothing. The reply
     * lists the chips created (the C++ returned all chips, R-2); an extra `data.items` is ignored (D-8).
     */
    private async createMany(data: unknown): Promise<SvtDbAgentKafkaChips.CreateManyChipsReplyMessageData> {
        const body = requireRecord(data, 'data')
        const create = validateRequestData(EpicChipCreateManyRequestDto, body['create'], 'data.create')
        if (!Array.isArray(create.items)) {
            throw SvtDbAgentNextRequestError.badRequest('data.create.items must be an array')
        }
        await this.assertGeneralLocation(create.generalLocation)

        const inputs = await this.toCreateInputs(create.items, create.generalLocation, 'data.create.items')
        const created = inputs.length > 0 ? await this.chips.createMany(inputs, this.createOptions()) : []
        return { items: created.map(toWire), totalCount: created.length }
    }

    /** `data` is the history record; the row written becomes the current location. */
    private async updateLocation(data: unknown): Promise<SvtDbAgentKafkaChips.UpdateChipLocationReplyMessageData> {
        const record = validateRequestData(SvtDbAgentNextChipLocationRecordDto, data, 'data')
        await this.assertGeneralLocation(record.generalLocation)

        const chip = await this.chips.appendLocation(record.chipId, {
            generalLocation: record.generalLocation,
            date: record.date ?? null,
            username: record.username ?? null,
            note: record.note ?? null,
        })
        if (!chip) {
            throw SvtDbAgentNextRequestError.notFound(`Chip ${record.chipId} not found`)
        }
        return { entity: toWire(chip) }
    }

    private async getLocationHistory(data: unknown): Promise<SvtDbAgentKafka.PageReplyMessageData<EpicChipLocationHistoryRecord>> {
        const chipId = requireInteger(requireRecord(data, 'data')['chipId'], 'data.chipId')
        if (!(await this.chips.findById(chipId))) {
            throw SvtDbAgentNextRequestError.notFound(`Chip ${chipId} not found`)
        }
        const history = await this.chips.findLocationHistory(chipId)
        return { items: history.map(toWireLocation), totalCount: history.length }
    }

    /**
     * Resolves the ASIC of every item: it must exist, appear once in the request and have no chip yet. The
     * family type travels with the input so the repository can pick the block types without another query.
     */
    private async toCreateInputs(items: ChipItem[], generalLocation: string, path: string): Promise<SvtDbChipCreateInput[]> {
        const asicIds = items.map((item) => item.asicId)
        const repeated = asicIds.find((id, index) => asicIds.indexOf(id) !== index)
        if (repeated !== undefined) {
            throw SvtDbAgentNextRequestError.badRequest(`Asic ${repeated} appears more than once in ${path}`)
        }

        const asics = new Map((await this.asics.findByIds(asicIds)).map((asic) => [asic.id, asic]))
        const [taken] = await this.chips.findByAsicIds(asicIds)
        if (taken) {
            throw SvtDbAgentNextRequestError.badRequest(`Asic ${taken.asic.id} already has a chip (${taken.id})`)
        }

        return items.map((item) => {
            const asic = asics.get(item.asicId)
            if (!asic) {
                throw SvtDbAgentNextRequestError.badRequest(`Asic ${item.asicId} does not exist`)
            }
            return { asicId: asic.id, asicFamilyType: asic.familyType, serialNumber: item.serialNumber, generalLocation }
        })
    }

    private createOptions(): SvtDbChipCreateOptions {
        return { generateBlocks: this.configService.get('features', { infer: true }).chipBlocks }
    }

    private async assertGeneralLocation(value: string): Promise<void> {
        const values = await this.enums.getValues('wpGeneralLocation')
        if (!values.includes(value)) {
            throw SvtDbAgentNextRequestError.badRequest(`${value} is not a value of the wpGeneralLocation enum`)
        }
    }

}

function toWire({ chip, familyType }: SvtDbChipWithFamilyType): EpicChip {
    return {
        id: chip.id,
        serialNumber: chip.serialNumber,
        generalLocation: chip.generalLocation,
        familyType,
    }
}

function toWireLocation(row: SvtDbChipLocationEntity): EpicChipLocationHistoryRecord {
    return {
        chipId: row.chip.id,
        generalLocation: row.generalLocation,
        date: row.date,
        note: row.note ?? '',
        username: row.username,
    }
}
