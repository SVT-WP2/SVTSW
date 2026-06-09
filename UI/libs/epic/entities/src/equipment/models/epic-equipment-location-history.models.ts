import { EpicDateString } from '../../common'


export type EpicEquipmentLocationHistoryRecordEntity = {
    equipmentId: number
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
