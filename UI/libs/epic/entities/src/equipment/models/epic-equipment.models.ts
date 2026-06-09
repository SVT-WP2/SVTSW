export type EpicEquipmentEntity = {
    id: number
    name: string
    equipmentTypeId: number
    generalLocation: string
    specification: string // JSON string
}

export type EpicEquipmentCreateEntity = Omit<EpicEquipmentEntity, 'id'>
