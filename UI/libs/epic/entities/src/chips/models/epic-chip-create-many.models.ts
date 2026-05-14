export type EpicChipCreateManyEntity = {
    generalLocation: string
    items: EpicChipCreateManyItemEntity[]
}

export type EpicChipCreateManyItemEntity = {
    serialNumber: string
    asicId: number
}

