export type EpicWpProjectEntity = {
    id: number
    wpMachineId: number
    waferTypeId: number
    name: string
    asicFamilyType: string
    orientation: string
    alignmentDie: string
    homeDie: string
    local2GlobalMap: string // JSON string
}


