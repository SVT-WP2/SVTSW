import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicWaferType, EpicWaferTypeCreate, EpicWaferTypeUpdate } from 'epic-ui/api'
import { EpicSelectFormControl, FileHelpers } from 'epic-ui/utils'


export namespace EpicWaferTypeUpdateForm {

    export enum FormField {
        name = 'name',
        engineeringRun = 'engineeringRun',
        foundry = 'foundry',
        technology = 'technology',
        waferMap = 'waferMap',
    }

    export type FormData = {
        name: string
        engineeringRun: string
        foundry: string
        technology: string
        waferMap: File | null
    }

    export type FormGroupControls = {
        [FormField.name]: FormControl<string | null>
        [FormField.engineeringRun]: EpicSelectFormControl
        [FormField.foundry]: EpicSelectFormControl
        [FormField.technology]: EpicSelectFormControl
        [FormField.waferMap]: FormControl<File | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup<FormGroupControls>({
            [FormField.name]: new FormControl<string | null>(formData?.name || null, Validators.required),
            [FormField.engineeringRun]: new EpicSelectFormControl(formData?.engineeringRun || null, [Validators.required]),
            [FormField.foundry]: new EpicSelectFormControl(formData?.foundry || null, [Validators.required]),
            [FormField.technology]: new EpicSelectFormControl(formData?.technology || null, [Validators.required]),
            [FormField.waferMap]: new FormControl<File | null>(formData?.waferMap || null, [Validators.required]),
        })
    }

    export function toFormData(entity: EpicWaferType): FormData {
        return {
            name: entity.name,
            engineeringRun: entity.engineeringRun,
            foundry: entity.foundry,
            technology: entity.technology,
            waferMap: null,
        }
    }

    export async function formDataToCreateRequest(formData: FormData): Promise<EpicWaferTypeCreate> {
        const waferMap = await FileHelpers.extractFileStringContent(formData.waferMap!)
        return {
            name: formData.name,
            engineeringRun: formData.engineeringRun,
            foundry: formData.foundry,
            technology: formData.technology,
            waferMap,
        }
    }

    export async function formDataToUpdateRequest(formData: FormData): Promise<EpicWaferTypeUpdate> {
        const waferMap = await FileHelpers.extractFileStringContent(formData.waferMap!)
        return {
            name: formData.name,
            waferMap,
        }
    }

}
