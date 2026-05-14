import { FormControl, FormGroup, Validators } from '@angular/forms'


export namespace EpicTcpSendMessageForm {

    export enum FormField {
        ipAddress = 'ipAddress',
        portNumber = 'portNumber',
        message = 'message',
    }

    export type FormValue = {
        ipAddress: string
        portNumber: number
        message: string
    }

    export type FormGroupControls = {
        [FormField.ipAddress]: FormControl<string | null>
        [FormField.portNumber]: FormControl<number | null>
        [FormField.message]: FormControl<string | null>
    }

    export function createFormGroup(): FormGroup<FormGroupControls> {
        return new FormGroup<FormGroupControls>({
            [FormField.ipAddress]: new FormControl<string>('128.141.63.133', Validators.required),
            [FormField.portNumber]: new FormControl<number>(35555, Validators.required),
            [FormField.message]: new FormControl<string>('', Validators.required),
        })
    }


}
