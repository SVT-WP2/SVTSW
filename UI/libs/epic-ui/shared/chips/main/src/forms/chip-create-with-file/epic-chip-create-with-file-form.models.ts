import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicChipCreateManyItem } from 'epic-ui/api'
import { EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicChipCreateWithFileForm {

    export enum FormField {
        asicToChipMap = 'asicToChipMap',
        generalLocation = 'generalLocation',
    }

    export type FormData = {
        asicToChipMap: File | null
        generalLocation: string
    }

    export type FormGroupControls = {
        [FormField.asicToChipMap]: FormControl<File | null>
        [FormField.generalLocation]: EpicSelectFormControl
    }

    export function createFromGroup(initFormData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.asicToChipMap]: new FormControl<File | null>(initFormData?.asicToChipMap || null, Validators.required),
            [FormField.generalLocation]: new EpicSelectFormControl(initFormData?.generalLocation || null, [Validators.required]),
        })
    }

    export function parseAsicToChipMapFileContent(csvContent: string[][]): EpicChipCreateManyItem[] {
        return csvContent
            .map(row => ({
                asicId: +row[0],
                serialNumber: row[1],
            }))
    }

}
