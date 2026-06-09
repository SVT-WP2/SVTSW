export namespace KeyboardHelpers {

    export enum Key {
        ArrowLeft = 'ArrowLeft',
        ArrowUp = 'ArrowUp',
        ArrowRight = 'ArrowRight',
        ArrowDown = 'ArrowDown',
        Home = 'Home',
        End = 'End',
        Enter = 'Enter',
        Backspace = 'Backspace',
        Delete = 'Delete',
        Tab = 'Tab',
        Space = 'Space',
    }

    export type NavigationKey =
        | Key.ArrowLeft
        | Key.ArrowUp
        | Key.ArrowRight
        | Key.ArrowDown
        | Key.Home
        | Key.End

    export const NavigationKey = {
        [Key.ArrowLeft]: Key.ArrowLeft as NavigationKey,
        [Key.ArrowUp]: Key.ArrowUp as NavigationKey,
        [Key.ArrowRight]: Key.ArrowRight as NavigationKey,
        [Key.ArrowDown]: Key.ArrowDown as NavigationKey,
        [Key.Home]: Key.Home as NavigationKey,
        [Key.End]: Key.End as NavigationKey,
    }

    export type EditKey =
        | Key.Backspace
        | Key.Delete

    export const EditKey = {
        [Key.Backspace]: Key.Backspace as EditKey,
        [Key.Delete]: Key.Delete as EditKey,
    }

    export function isNumberKey(event: KeyboardEvent): boolean {
        const numbers = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        return event.code.startsWith('Digit') || (numbers.includes(parseInt(event.key, 10))) || event.key === '.'
    }

    export function isAlphabetKey(event: KeyboardEvent): boolean {
        return event.code.startsWith('Key')
    }

    export function isNavigationKey(event: KeyboardEvent): boolean {
        return Object.values(NavigationKey).includes(event.code as any)
    }

    export function isEditKey(event: KeyboardEvent): boolean {
        return Object.values(EditKey).includes(event.code as any)
    }

}
