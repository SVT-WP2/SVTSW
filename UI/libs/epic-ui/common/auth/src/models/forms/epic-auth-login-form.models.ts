import { FormControl, FormGroup, Validators } from '@angular/forms'


export namespace EpicAuthLoginForm {

    export enum FormField {
        login = 'login',
        password = 'password',
    }

    export type FormData = {
        login: string
        password: string
    }

    export type FormGroupControls = {
        [FormField.login]: FormControl<string | null>
        [FormField.password]: FormControl<string | null>
    }

    export function createFromGroup(): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.login]: new FormControl<string | null>(null, Validators.required),
            [FormField.password]: new FormControl<string | null>(null, [Validators.required]),
        })
    }


}
