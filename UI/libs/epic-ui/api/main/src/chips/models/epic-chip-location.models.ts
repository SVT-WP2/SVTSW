export type EpicChipLocation = {
    chipId: number
    generalLocation: string
    date: string | null
    note: string
    username?: string | null
}

export type EpicChipLocationUpdate = {
    date: string | null
    generalLocation: string
    note: string
}

