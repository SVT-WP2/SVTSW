import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicPasswordForm } from 'epic-ui/common/auth'
import { EpicUserPasswordSetRequest } from 'svt-ts-types'


/** The form of the "Set password" dialog: the new password of a user and its repetition. */
export namespace EpicUserPasswordForm {

    export enum FormField {
        password = 'password',
        repeatPassword = 'repeatPassword',
    }

    export type FormData = {
        password: string
        repeatPassword: string
    }

    export type FormGroupControls = {
        [FormField.password]: FormControl<string | null>
        [FormField.repeatPassword]: FormControl<string | null>
    }

    export function createFromGroup(): FormGroup<FormGroupControls> {
        const password = new FormControl<string | null>(null, EpicPasswordForm.newPasswordValidators())
        const repeatPassword = new FormControl<string | null>(null, Validators.required)
        EpicPasswordForm.linkRepeatControl(password, repeatPassword)
        return new FormGroup<FormGroupControls>({
            [FormField.password]: password,
            [FormField.repeatPassword]: repeatPassword,
        })
    }

    /** The body of `POST /api/users/:id/password`: the repetition stays in the browser. */
    export function toRequest(formData: FormData): EpicUserPasswordSetRequest {
        return { password: formData.password }
    }

}
