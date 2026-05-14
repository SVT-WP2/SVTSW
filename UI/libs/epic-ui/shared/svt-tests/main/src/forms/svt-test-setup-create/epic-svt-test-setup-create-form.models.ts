import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicSvtTestSetup, EpicSvtTestSetupCreate } from 'epic-ui/api'
import { EpicSelectFormControl, FileHelpers } from 'epic-ui/utils'


export namespace EpicSvtTestSetupCreateForm {

    export const FormField: Record<keyof FormGroupControls, keyof FormGroupControls> = {
        name: 'name',
        generalLocation: 'generalLocation',
        configName: 'configName',
        configBody: 'configBody',
        configNote: 'configNote',
    }

    export type FormData = {
        name: string
        generalLocation: string
        configName: string | null
        configBody: File | null
        configNote: string | null
    }

    export type FormGroupControls = {
        name: FormControl<string | null>
        generalLocation: EpicSelectFormControl
        configName: FormControl<string | null>
        configBody: FormControl<File | null>
        configNote: FormControl<string | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            name: new FormControl<string | null>(formData?.name || null, Validators.required),
            generalLocation: new EpicSelectFormControl(formData?.generalLocation || null, Validators.required),
            configName: new FormControl<string | null>(formData?.configName || null, Validators.required),
            configBody: new FormControl<File | null>(formData?.configBody || null, Validators.required),
            configNote: new FormControl<string | null>(formData?.configNote || null),
        })
    }

    export function toFormData(entity: EpicSvtTestSetup): FormData {
        return {
            name: entity.name,
            generalLocation: entity.generalLocation,
            configName: null,
            configBody: null,
            configNote: null,
        }
    }

    export async function formDataToCreateRequest(formData: FormData): Promise<EpicSvtTestSetupCreate> {
        const configBody = await FileHelpers.extractFileStringContent(formData.configBody!)
        return {
            name: formData.name,
            generalLocation: formData.generalLocation,
            defaultConfig: {
                name: formData.configName || '',
                note: formData.configNote ?? null,
                configBody: configBody,
            },
        }
    }

}
