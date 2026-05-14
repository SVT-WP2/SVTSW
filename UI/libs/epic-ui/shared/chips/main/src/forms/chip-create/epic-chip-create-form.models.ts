import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicChipCreateForm {

    export enum FormField {
        serialNumber = 'serialNumber',
        generalLocation = 'generalLocation',
    }

    export type FormData = {
        serialNumber: string
        generalLocation: string
    }

    export type FormGroupControls = {
        [FormField.serialNumber]: FormControl<string | null>
        [FormField.generalLocation]: EpicSelectFormControl
    }

    export function createFromGroup(initFormData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.serialNumber]: new FormControl<string | null>(initFormData?.serialNumber || null, Validators.required),
            [FormField.generalLocation]: new EpicSelectFormControl(initFormData?.generalLocation || null, [Validators.required]),
        })
    }

}
