export type EpicWpProbeCard = {
    id: number
    serialNumber: string
    name: string
    vendor: string
    model: string
    arriveDate: string
    location: string
    type: string
    vendorCleaningInterval: number
}

export type EpicWpProbeCardCreate = {
    serialNumber: string
    name: string
    vendor: string
    model: string
    arriveDate: string
    location: string
    type: string
    vendorCleaningInterval: number
}

export type EpicWpProbeCardUpdate = {
    location: string
    vendorCleaningInterval: number
}

