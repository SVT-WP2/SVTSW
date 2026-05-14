import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicEquipment, EpicEquipmentCreate, EpicEquipmentType } from 'epic-ui/api'
import { EpicSelectFormControl, FileHelpers } from 'epic-ui/utils'


export namespace EpicEquipmentUpdateForm {

    export enum FormField {
        name = 'name',
        equipmentTypeId = 'equipmentTypeId',
        generalLocation = 'generalLocation',
        specification = 'specification',
    }

    export type FormData = {
        name: string
        equipmentTypeId: number
        generalLocation: string
        specification: File | null
    }

    export type FormGroupControls = {
        [FormField.name]: FormControl<string | null>
        [FormField.equipmentTypeId]: EpicSelectFormControl<number | null, EpicEquipmentType>
        [FormField.generalLocation]: EpicSelectFormControl
        [FormField.specification]: FormControl<File | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup<FormGroupControls>({
            [FormField.name]: new FormControl<string | null>(formData?.name || null, Validators.required),
            [FormField.equipmentTypeId]: new EpicSelectFormControl<number | null, EpicEquipmentType>(
                formData?.equipmentTypeId || null, Validators.required,
            ),
            [FormField.generalLocation]: new EpicSelectFormControl(formData?.generalLocation || null, Validators.required),
            [FormField.specification]: new FormControl<File | null>(formData?.specification || null, Validators.required),
        })
    }

    export function toFormData(entity: EpicEquipment): FormData {
        return {
            name: entity.name,
            equipmentTypeId: entity.equipmentTypeId,
            generalLocation: entity.generalLocation,
            specification: FileHelpers.stringContentToJsonFile(entity.specification, 'equipment-specifications.json'),
        }
    }

    export async function formDataToEpicEquipmentCreate(formData: FormData): Promise<EpicEquipmentCreate> {
        const specification = await FileHelpers.extractFileStringContent(formData.specification!)
        return {
            name: formData.name,
            equipmentTypeId: formData.equipmentTypeId,
            generalLocation: formData.generalLocation,
            specification,
        }
    }

}
