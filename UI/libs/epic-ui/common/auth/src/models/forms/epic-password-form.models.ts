import { AbstractControl, FormControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms'
import { EPIC_USER_PASSWORD_MAX_LENGTH, EPIC_USER_PASSWORD_MIN_LENGTH } from 'svt-ts-types'


/** The checks of a new password and of its repetition, for every form that sets a password. */
export namespace EpicPasswordForm {

    /** The error of a repeat field that differs from its password field. */
    export const MISMATCH_ERROR = 'passwordMismatch'

    /** A new password: required, 8 to 128 characters (the rule of the BFF), nothing else. */
    export function newPasswordValidators(): ValidatorFn[] {
        return [
            Validators.required,
            Validators.minLength(EPIC_USER_PASSWORD_MIN_LENGTH),
            Validators.maxLength(EPIC_USER_PASSWORD_MAX_LENGTH),
        ]
    }

    /**
     * Makes `repeat` the repetition of `password`: it has `MISMATCH_ERROR` while it holds a text that differs from the
     * password, and it is checked again whenever the password changes. An empty repeat field is the `required` error.
     */
    export function linkRepeatControl(password: FormControl<string | null>, repeat: FormControl<string | null>): void {
        repeat.addValidators((control: AbstractControl): ValidationErrors | null => (
            control.value && control.value !== password.value ? { [MISMATCH_ERROR]: true } : null
        ))
        password.valueChanges.subscribe(() => repeat.updateValueAndValidity())
    }

    /** The text under a password field, or `null` when it is valid. */
    export function getErrorText(control: AbstractControl): string | null {
        if (control.hasError('required')) {
            return 'Required Field'
        }
        if (control.hasError('minlength')) {
            return `At least ${EPIC_USER_PASSWORD_MIN_LENGTH} characters`
        }
        if (control.hasError('maxlength')) {
            return `At most ${EPIC_USER_PASSWORD_MAX_LENGTH} characters`
        }
        if (control.hasError(MISMATCH_ERROR)) {
            return 'The two passwords differ'
        }
        return null
    }

}
