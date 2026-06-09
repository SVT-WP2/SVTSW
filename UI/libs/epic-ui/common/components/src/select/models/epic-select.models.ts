export namespace EpicSelect {

    export type Size = 'small' | 'basic'

    export const Size: Record<Size, Size> = {
        small: 'small',
        basic: 'basic',
    }

    export type TemplateName = 'option' | 'selectedOption' | 'group' | 'noResult' | 'loading'
    export const TemplateName = {
        option: 'option' as TemplateName,
        selectedOption: 'selectedOption' as TemplateName,
        group: 'group' as TemplateName,
        noResult: 'noResult' as TemplateName,
        loading: 'loading' as TemplateName,
    }

    export type GroupValueFn = (key: string | any, children: any[]) => string | any

    export type CompareWithFn<T = any> = (option: T, selectedOption: T) => boolean

    export function compareValueWithId<T extends { id: string | number } = any, TOption extends { value: T } = { value: T }>(
        option: TOption,
        selectedOption: T,
    ): boolean {

        return option.value.id === selectedOption.id
    }

}
