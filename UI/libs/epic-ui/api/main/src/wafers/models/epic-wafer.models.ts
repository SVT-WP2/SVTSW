export type EpicWafer = {
    id: number
    serialNumber: string
    batchNumber: number
    thinningDate: string | null
    dicingDate: string | null
    productionDate: string | null
    waferTypeId: number
    generalLocation: string | null
}

export type EpicWaferCreate = Omit<EpicWafer, 'id'>

export type EpicWaferUpdate = {
    thinningDate?: string | null
    dicingDate?: string | null
    productionDate?: string | null
}

