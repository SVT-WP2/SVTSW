import { EpicDateString } from '../../common'


export type EpicEquipmentLocationUpdate = {
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
