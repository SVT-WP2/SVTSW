export type EpicAsicBase = {
    id: number
    serialNumber: string
    waferId: number
    chipId?: number | null
    familyType: string
    waferMapPosition: string
    quality: string
}

export type EpicAsic =
    & EpicAsicBase
    &
    {
        waferSerialNumber?: string
    }
