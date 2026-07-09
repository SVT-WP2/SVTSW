export type EpicChipBlockEntity = {
    id: number
    chipId: number
    chipBlockType: string
    serialNumber: string
}

export type EpicGetAllChipBlocksQueryFilter = {
    ids?: number[]
    chipId?: number
    blockTypes?: string[]
}
