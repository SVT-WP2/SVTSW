import { EpicDateString } from '../../common'


export type EpicChipLocationUpdate = {
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
