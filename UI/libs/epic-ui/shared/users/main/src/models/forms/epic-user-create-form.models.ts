import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicPasswordForm } from 'epic-ui/common/auth'
import { EpicUserCreateRequest, EpicUserRole } from 'svt-ts-types'

import { EpicUserFormValidators } from './epic-user-form-validators.models'


/** The form of a new user: login, name, role, password and its repetition. */
export namespace EpicUserCreateForm {

    export enum FormField {
        login = 'login',
        name = 'name',
        role = 'role',
        password = 'password',
        repeatPassword = 'repeatPassword',
    }

    export type FormData = {
        login: string
        name: string
        role: EpicUserRole
        password: string
        repeatPassword: string
    }

    export type FormGroupControls = {
        [FormField.login]: FormControl<string | null>
        [FormField.name]: FormControl<string | null>
        [FormField.role]: FormControl<EpicUserRole | null>
        [FormField.password]: FormControl<string | null>
        [FormField.repeatPassword]: FormControl<string | null>
    }

    /** A new user is a `User` unless the Admin picks another role. */
    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        const password = new FormControl<string | null>(null, EpicPasswordForm.newPasswordValidators())
        const repeatPassword = new FormControl<string | null>(null, Validators.required)
        EpicPasswordForm.linkRepeatControl(password, repeatPassword)
        return new FormGroup<FormGroupControls>({
            [FormField.login]: new FormControl<string | null>(formData?.login ?? null, EpicUserFormValidators.loginValidators()),
            [FormField.name]: new FormControl<string | null>(formData?.name ?? null, EpicUserFormValidators.nameValidators()),
            [FormField.role]: new FormControl<EpicUserRole | null>(formData?.role ?? EpicUserRole.User, Validators.required),
            [FormField.password]: password,
            [FormField.repeatPassword]: repeatPassword,
        })
    }

    /** The body of `POST /api/users`: the repetition stays in the browser; the BFF trims the login. */
    export function toRequest(formData: FormData): EpicUserCreateRequest {
        return {
            login: formData.login,
            name: formData.name.trim(),
            role: formData.role,
            password: formData.password,
        }
    }

}
