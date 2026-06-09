import { isNil, mapValues, mean, toNumber } from 'lodash-es'


export namespace NumberHelpers {

    export type Pow10 = 1 | 1e3 | 1e6 | 1e9 | 1e12 | 1e15 | 1e18

    export const POWER_10_ALIAS_MAP: Record<number, string> = {
        [1]: '',
        [1e3]: 'k',
        [1e6]: 'M',
        [1e9]: 'B',
        [1e12]: 'T',
        [1e15]: 'P',
        [1e18]: 'E',
    }

    export function getRandomInt(min: number, max: number): number {
        min = Math.ceil(min)
        max = Math.floor(max)
        return Math.floor(Math.random() * (max - min + 1)) + min
    }

    export function toFixedNumber(num: number, digits: number, base: number = 10) {
        const pow = Math.pow(base || 10, digits)
        return Math.round(num * pow) / pow
    }

    export function getPercentageInRange(value: number, min: number, max: number): number {
        return (value - min) / (max - min)
    }

    // Formats 2500 => 2.5k, 1 300 000 => 1,3M, etc.
    export function toReadableFormat(number: number, digits: number = 2): string {
        const lookup = Object.keys(POWER_10_ALIAS_MAP).map(key => {
            const value = toNumber(key)
            return {
                value,
                symbol: POWER_10_ALIAS_MAP[value],
            }
        })

        const rx = /\.0+$|(\.[0-9]*[1-9])0+$/
        const targetItem = lookup.slice().reverse().find((item) => Math.abs(number) >= item.value)
        return targetItem
            ? (number / targetItem.value).toFixed(digits).replace(rx, '$1') + targetItem.symbol
            : '0'
    }

    export const GB_LOCALE = 'en-GB'

    export function numberToLocalFormat(number: number, locale: string = GB_LOCALE): string {
        return number.toLocaleString(locale)
    }

    export function getAverageNumber(numbers: number[]): number {
        return mean(numbers.filter((number) => !isNil(number)))
    }

    export function toPow10Format(value: number, pow10: Pow10, digits = 2): string {
        const unitAlias = POWER_10_ALIAS_MAP[pow10] ?? ''
        return toFixedNumber((value / pow10), digits).toString() + unitAlias
    }

    export function roundNumber(value: number | null, digits = 0): number | null {
        return !isNil(value) ? NumberHelpers.toFixedNumber(value, digits) : null
    }

    export function formatNumberRounded(value: number | null): string | null {
        return !isNil(value)
            ? value.toLocaleString('en-us', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
            : null
    }

    export function formatNumberDecimals(value: number | null, decimals = 2): string | null {
        return !isNil(value)
            ? value.toLocaleString('en-us', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : null
    }

    export function formatNumber(value: number | null): string | null {
        return !isNil(value)
            ? value.toLocaleString('en-us', { minimumFractionDigits: 0, maximumFractionDigits: 100 })
            : null
    }

    export function roundRecordValues<TRecord extends Record<string, any>>(record: TRecord, digits = 0): TRecord {
        return mapValues(record, (value) => (
            isFinite(value) ? roundNumber(value as number, digits) : value
        )) as TRecord
    }

}
