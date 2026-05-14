import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicEquipmentType } from 'epic-ui/api'


export namespace EpicEquipmentTypeUpdateForm {

    export enum FormField {
        name = 'name',
    }

    export type FormData = {
        name: string
    }

    export type FormGroupControls = {
        [FormField.name]: FormControl<string | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup<FormGroupControls>({
            [FormField.name]: new FormControl<string | null>(formData?.name || null, Validators.required),
        })
    }

    export function toFormData(entity: EpicEquipmentType): FormData {
        return {
            name: entity.name,
        }
    }

}
