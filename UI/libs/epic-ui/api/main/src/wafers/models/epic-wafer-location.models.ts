export type EpicWaferLocation = {
    waferId: number
    generalLocation: string
    date: string | null
    note: string
    username?: string | null
}

export type EpicWaferLocationUpdate = {
    date: string | null
    generalLocation: string
    note: string
}

