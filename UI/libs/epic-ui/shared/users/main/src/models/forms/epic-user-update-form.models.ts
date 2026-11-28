import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicUser, EpicUserRole } from 'svt-ts-types'

import { EpicUserFormValidators } from './epic-user-form-validators.models'


/** The form of the edit dialog: name and role. The login is shown, and cannot be changed. */
export namespace EpicUserUpdateForm {

    export enum FormField {
        name = 'name',
        role = 'role',
    }

    export type FormData = {
        name: string
        role: EpicUserRole
    }

    export type FormGroupControls = {
        [FormField.name]: FormControl<string | null>
        [FormField.role]: FormControl<EpicUserRole | null>
    }

    export type FormOptions = {
        /** The user's login, shown above the fields. */
        login: string
        /** The own user: the role select is disabled (`EpicUsersRules.OWN_USER_HINT`). */
        isOwnUser: boolean
    }

    export function createFromGroup(formData?: Partial<FormData>, options?: Partial<FormOptions>): FormGroup<FormGroupControls> {
        return new FormGroup<FormGroupControls>({
            [FormField.name]: new FormControl<string | null>(formData?.name ?? null, EpicUserFormValidators.nameValidators()),
            [FormField.role]: new FormControl<EpicUserRole | null>(
                { value: formData?.role ?? null, disabled: !!options?.isOwnUser },
                Validators.required,
            ),
        })
    }

    export function toFormData(user: EpicUser): FormData {
        return {
            name: user.name,
            role: user.role,
        }
    }

}
