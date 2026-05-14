export type EpicWaferType = {
    id: number
    name: string
    engineeringRun: string
    foundry: string
    technology: string
}

export type EpicWaferTypeCreate = {
    name: string
    engineeringRun: string
    foundry: string
    technology: string
    waferMap: string
}

export type EpicWaferTypeUpdate = {
    name: string
    waferMap: string
}
