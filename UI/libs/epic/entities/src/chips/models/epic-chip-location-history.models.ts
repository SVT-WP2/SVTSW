import { EpicDateString } from '../../common'


export type EpicChipLocationHistoryRecordEntity = {
    chipId: number
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
