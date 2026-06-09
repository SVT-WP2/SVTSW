import moment from 'moment'

import { StringHelpers } from './string.helpers'


export namespace DateTimeHelpers {

    export const FULL_DATE = 'yyyy-MM-DD'
    export const FULL_DATE_TIME = 'yyyy-MM-DD HH:mm:ss'

    export function toString(date: Date | string, format: string = FULL_DATE_TIME): string {
        return moment(date).format(format)
    }

    export function secondsToTimeString(timeInSeconds: number): string {
        const minutes = StringHelpers.numberToString(Math.floor(timeInSeconds / 60), 2)
        const seconds = StringHelpers.numberToString(timeInSeconds % 60, 2)

        return `${minutes}:${seconds}`
    }

}
