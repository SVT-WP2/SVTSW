export type EpicChip = {
    id: number
    serialNumber: string
    generalLocation: string
}

export type EpicChipCreate = {
    asicId: number
    serialNumber: string
    generalLocation: string
}

export type EpicChipCreateMany = {
    generalLocation: string
    items: EpicChipCreateManyItem[]
}

export type EpicChipCreateManyItem = {
    asicId: number
    serialNumber: string
}
