import { FormControl, FormGroup, Validators } from '@angular/forms'
import { DateTimeHelpers, EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicLocationUpdateForm {

    export enum FormField {
        generalLocation = 'generalLocation',
        date = 'date',
        note = 'note',
    }

    export type FormData = {
        generalLocation: string | null
        date: string | null
        note: string | null
    }

    export type FormGroupControls = {
        [FormField.generalLocation]: EpicSelectFormControl
        [FormField.date]: FormControl<string | null>
        [FormField.note]: FormControl<string | null>
    }

    export type FormOptions = {
        excludeGeneralLocation?: string[]
    }

    export function createFromGroup(initFormData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.generalLocation]: new EpicSelectFormControl(initFormData?.generalLocation ?? '', [Validators.required]),
            [FormField.note]: new FormControl<string | null>(initFormData?.note ?? '', [Validators.required]),
            [FormField.date]: new FormControl<string | null>(
                initFormData?.date ?? DateTimeHelpers.toString(new Date()),
            ),
        })
    }

}
