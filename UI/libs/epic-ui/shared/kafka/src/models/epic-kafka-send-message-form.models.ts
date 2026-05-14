import { FormControl, FormGroup, Validators } from '@angular/forms'


export namespace EpicKafkaSendMessageForm {

    export enum FormField {
        topicName = 'topicName',
        message = 'message',
    }

    export type FormValue = {
        topicName: string
        message: string
    }

    export type FormGroupControls = {
        [FormField.topicName]: FormControl<string | null>
        [FormField.message]: FormControl<string | null>
    }

    export function createFormGroup(): FormGroup<FormGroupControls> {
        return new FormGroup<FormGroupControls>({
            [FormField.topicName]: new FormControl<string>('', Validators.required),
            [FormField.message]: new FormControl<string>('', Validators.required),
        })
    }


}
