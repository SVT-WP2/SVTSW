import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicAuthPasswordChangeRequest } from 'svt-ts-types'

import { EpicPasswordForm } from './epic-password-form.models'


/** The form of the own password: the current one, the new one and its repetition. */
export namespace EpicAuthPasswordChangeForm {

    export enum FormField {
        currentPassword = 'currentPassword',
        newPassword = 'newPassword',
        repeatPassword = 'repeatPassword',
    }

    export type FormData = {
        currentPassword: string
        newPassword: string
        repeatPassword: string
    }

    export type FormGroupControls = {
        [FormField.currentPassword]: FormControl<string | null>
        [FormField.newPassword]: FormControl<string | null>
        [FormField.repeatPassword]: FormControl<string | null>
    }

    export function createFromGroup(): FormGroup<FormGroupControls> {
        const newPassword = new FormControl<string | null>(null, EpicPasswordForm.newPasswordValidators())
        const repeatPassword = new FormControl<string | null>(null, Validators.required)
        EpicPasswordForm.linkRepeatControl(newPassword, repeatPassword)
        return new FormGroup<FormGroupControls>({
            [FormField.currentPassword]: new FormControl<string | null>(null, Validators.required),
            [FormField.newPassword]: newPassword,
            [FormField.repeatPassword]: repeatPassword,
        })
    }

    /** The body of `POST /api/auth/password`: the repetition stays in the browser. */
    export function toRequest(formData: FormData): EpicAuthPasswordChangeRequest {
        return {
            currentPassword: formData.currentPassword,
            newPassword: formData.newPassword,
        }
    }

}
