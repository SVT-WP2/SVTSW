/** The `GetAllChipBlocks` Kafka filter. The HTTP query (`EpicChipBlocksListQuery`) maps onto it one-to-one today. */
export type EpicGetAllChipBlocksQueryFilter = {
    ids?: number[]
    chipId?: number
    chipBlockTypes?: string[]
    serialNumber?: string
}
