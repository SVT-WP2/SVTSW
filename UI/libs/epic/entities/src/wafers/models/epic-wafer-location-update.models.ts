import { EpicDateString } from '../../common'


export type EpicWaferLocationUpdate = {
    generalLocation: string
    date: EpicDateString | null
    note: string
    username: string | null
}
