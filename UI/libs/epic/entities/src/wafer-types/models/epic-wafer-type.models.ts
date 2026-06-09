export type EpicWaferTypeEntity = {
    id: number
    name: string
    engineeringRun: string
    foundry: string
    technology: string
}

export type EpicWaferTypeCreateEntity = {
    name: string
    engineeringRun: string
    foundry: string
    technology: string
    waferMap: string | null
}
