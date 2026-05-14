export type EpicEquipmentType = {
    id: number
    name: string
}

export type EpicEquipmentTypeCreate = Omit<EpicEquipmentType, 'id'>
