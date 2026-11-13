import { EpicChipBlock } from 'epic-api-types'


/** Kafka wire type (DB agent ↔ BFF). Identical to the HTTP contract type today — see this lib's README. */
export type EpicChipBlockEntity = EpicChipBlock

/** The `GetAllChipBlocks` Kafka filter. The HTTP query (`EpicChipBlocksListQuery`) maps onto it one-to-one today. */
export type EpicGetAllChipBlocksQueryFilter = {
    ids?: number[]
    chipId?: number
    chipBlockTypes?: string[]
    serialNumber?: string
}
