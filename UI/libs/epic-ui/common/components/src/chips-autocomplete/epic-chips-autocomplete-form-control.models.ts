import { EpicRecord } from 'epic-ui/utils'


export namespace EpicChipsAutocompleteFormControl {

    export type Value = (string | number)[]

    export type PreValue = string | number

    export type InputType = 'text' | 'number'

    export const InputType: EpicRecord<InputType, InputType> = {
        text: 'text',
        number: 'number',
    }

    export function getFilteredOptions(
        chips: Value,
        preValue: PreValue,
        options: Value,
    ): Value {
        const availableOptions = options?.filter((option) => (
            !chips.includes(option)
        )) ?? []

        if (!preValue) {
            return availableOptions
        }

        return availableOptions.filter((option) => (
            `${option}`.toLowerCase().includes(`${preValue}`.toLowerCase())
        ))
    }

    export function parseValue(value: string | number, inputType: InputType): string | number {
        if (inputType === InputType.number) {
            const parsedNumber = Number(value)
            if (isNaN(parsedNumber)) {
                console.warn(`Invalid number format: ${value}`)
                return 0
            }
            return parsedNumber
        }

        return `${value ?? ''}`.trim()
    }

    export function getFormattedValue(value: Value | null, inputType: InputType): Value {
        return (value || [])
            .map((val) => parseValue(val, inputType))
            .filter((val) => val !== null)
    }

}
