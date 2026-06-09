export type EpicEquipmentLocation = {
    equipmentId: number
    generalLocation: string
    date: string | null
    note: string
    username?: string | null
}

export type EpicEquipmentLocationUpdate = {
    date: string | null
    generalLocation: string
    note: string
}

