import { EpicDateString } from '../../common'


export type EpicWaferLocationHistoryRecordEntity = {
    waferId: number
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
