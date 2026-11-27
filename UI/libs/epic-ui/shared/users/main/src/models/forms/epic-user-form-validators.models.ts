import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { EPIC_USER_NAME_MAX_LENGTH, isEpicUserLogin, normalizeEpicUserLogin } from 'svt-ts-types'


/** The checks of the login and the name in the forms of the users page (the rules of the DB agent). */
export namespace EpicUserFormValidators {

    export const LOGIN_RULE_ERROR = 'loginRule'
    export const BLANK_ERROR = 'blank'

    /** The login rule, on the login as the BFF sends it: trimmed, in lower case. An empty value is `required`'s. */
    export function loginRule(control: AbstractControl<string | null>): ValidationErrors | null {
        const value = control.value
        return value && !isEpicUserLogin(normalizeEpicUserLogin(value)) ? { [LOGIN_RULE_ERROR]: true } : null
    }

    /** A text of spaces only is no value. */
    export function notBlank(control: AbstractControl<string | null>): ValidationErrors | null {
        const value = control.value
        return value && !value.trim() ? { [BLANK_ERROR]: true } : null
    }

    export function loginValidators(): ValidatorFn[] {
        return [Validators.required, loginRule]
    }

    export function nameValidators(): ValidatorFn[] {
        return [Validators.required, notBlank, Validators.maxLength(EPIC_USER_NAME_MAX_LENGTH)]
    }

    /** The text under a login or a name field, or `null` when it is valid. */
    export function getErrorText(control: AbstractControl): string | null {
        if (control.hasError('required') || control.hasError(BLANK_ERROR)) {
            return 'Required Field'
        }
        if (control.hasError(LOGIN_RULE_ERROR)) {
            return '3 to 50 characters: a-z, 0-9, ".", "_" and "-"'
        }
        if (control.hasError('maxlength')) {
            return `At most ${EPIC_USER_NAME_MAX_LENGTH} characters`
        }
        return null
    }

}
