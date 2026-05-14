export namespace EpicButton {

    export type ButtonSize = 'basic' | 'small'
    export const ButtonSize = {
        basic: 'basic' as ButtonSize,
        small: 'small' as ButtonSize,
    }

    export type ButtonStyle = 'basic' | 'flat' | 'stroked'
    export const ButtonStyle = {
        basic: 'basic' as ButtonStyle,
        flat: 'flat' as ButtonStyle,
        stroked: 'stroked' as ButtonStyle,
    }

    export const BASE_CLASS_NAME = 'epic-button'
    export const BASE_MAT_CLASS_NAME = 'mat-mdc-button-base'

    export function getSizeCssClassName(buttonSize: ButtonSize): string {
        return `epic-button-size--${buttonSize}`
    }

    export function getStyleCssClassName(buttonStyle: ButtonStyle): string {
        return `epic-button-style--${buttonStyle}`
    }

    export const HOST_SELECTOR_TO_EPIC_BUTTON_CLASS_MAP: { selector: string; cssClasses: string[] }[] = [
        {
            selector: 'epicButton',
            cssClasses: [BASE_CLASS_NAME, BASE_MAT_CLASS_NAME],
        },
        {
            selector: 'epicSmallButton',
            cssClasses: [BASE_CLASS_NAME, getSizeCssClassName(ButtonSize.small), BASE_MAT_CLASS_NAME],
        },
        {
            selector: 'epicFlatButton',
            cssClasses: [
                BASE_CLASS_NAME, getStyleCssClassName(ButtonStyle.flat),
                BASE_MAT_CLASS_NAME, 'mdc-button--unelevated', 'mat-mdc-unelevated-button',
            ],
        },
        {
            selector: 'epicStrokedButton',
            cssClasses: [
                BASE_CLASS_NAME, getStyleCssClassName(ButtonStyle.stroked),
                BASE_MAT_CLASS_NAME, 'mdc-button--outlined', 'mat-mdc-outlined-button',
            ],
        },
    ]

}
