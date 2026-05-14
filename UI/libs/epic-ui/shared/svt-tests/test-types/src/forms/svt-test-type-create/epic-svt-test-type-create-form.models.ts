import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicSvtTestType, EpicSvtTestTypeCreate } from 'epic-ui/api'
import { EpicSelectFormControl, FileHelpers } from 'epic-ui/utils'


export namespace EpicSvtTestTypeCreateForm {

    export const FormField: Record<keyof FormGroupControls, keyof FormGroupControls> = {
        name: 'name',
        dutTypes: 'dutTypes',
        configName: 'configName',
        configBody: 'configBody',
        configNote: 'configNote',
    }

    export type FormData = {
        name: string
        dutTypes: string[]
        configName: string | null
        configBody: File | null
        configNote: string | null
    }

    export type FormGroupControls = {
        name: FormControl<string | null>
        dutTypes: EpicSelectFormControl<string[], string>
        configName: FormControl<string | null>
        configBody: FormControl<File | null>
        configNote: FormControl<string | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            name: new FormControl<string | null>(formData?.name || null, Validators.required),
            dutTypes: new EpicSelectFormControl<string[], string>(formData?.dutTypes || null, Validators.required),
            configName: new FormControl<string | null>(formData?.configName || null, Validators.required),
            configBody: new FormControl<File | null>(formData?.configBody || null, Validators.required),
            configNote: new FormControl<string | null>(formData?.configNote || null),
        })
    }

    export function toFormData(entity: EpicSvtTestType): FormData {
        return {
            name: entity.name,
            dutTypes: entity.dutTypes,
            configName: null,
            configBody: null,
            configNote: null,
        }
    }

    export async function formDataToCreateRequest(formData: FormData): Promise<EpicSvtTestTypeCreate> {
        const configBody = await FileHelpers.extractFileStringContent(formData.configBody!)
        return {
            name: formData.name,
            dutTypes: formData.dutTypes || [],
            testTypeConfig: {
                name: formData.configName || '',
                note: formData.configNote ?? null,
                configBody: configBody,
            },
        }
    }

}

