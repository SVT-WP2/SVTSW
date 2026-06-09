export type EpicEquipment = {
    id: number
    name: string
    equipmentTypeId: number
    generalLocation: string
    specification: string // JSON string
}

export type EpicEquipmentCreate = Omit<EpicEquipment, 'id'>
