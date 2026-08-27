import moment from 'moment'


export namespace EpicInlineFilterDateRange {

    export const DATE_FORMAT = 'DD.MM.YY'

    /**
     * Both bounds are whole days the user picked in the calendar, kept as ISO date-time strings and both
     * inclusive. An API that wants an exclusive upper bound has to shift `to` itself — see `toExclusiveTo`.
     */
    export type Value = {
        from: string | null
        to: string | null
    }

    export function getDefaultValue(): Value {
        return {
            from: null,
            to: null,
        }
    }

    export function isEmpty(value: Value | null | undefined): boolean {
        return !value?.from && !value?.to
    }

    export function toLabel(value: Value | null | undefined): string {
        if (isEmpty(value)) {
            return ''
        }

        const from = value!.from ? moment(value!.from).format(DATE_FORMAT) : ''
        const to = value!.to ? moment(value!.to).format(DATE_FORMAT) : ''

        return from === to ? from : `${from} - ${to}`
    }

    /**
     * Turns the inclusive upper bound the user picked into the exclusive one the API expects: picking the 5th
     * means "up to the end of the 5th", which is the same as "before the 6th".
     */
    export function toExclusiveTo(value: Value | null | undefined): string | null {
        return value?.to
            ? moment(value.to).startOf('day').add(1, 'day').toISOString()
            : null
    }

    export function toInclusiveFrom(value: Value | null | undefined): string | null {
        return value?.from
            ? moment(value.from).startOf('day').toISOString()
            : null
    }

}
