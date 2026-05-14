import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicSvtTestSetupConfigCreate } from 'epic-ui/api'
import { FileHelpers } from 'epic-ui/utils'


export namespace EpicSvtTestSetupConfigCreateForm {

    export const FormField: Record<keyof FormGroupControls, keyof FormGroupControls> = {
        name: 'name',
        configBody: 'configBody',
        note: 'note',
    }

    export type FormData = {
        name: string
        configBody: File | null
        note: string | null
    }

    export type FormGroupControls = {
        name: FormControl<string | null>
        configBody: FormControl<File | null>
        note: FormControl<string | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            name: new FormControl<string | null>(formData?.name || null, Validators.required),
            configBody: new FormControl<File | null>(formData?.configBody || null, Validators.required),
            note: new FormControl<string | null>(formData?.note || null),
        })
    }

    export async function formDataToCreateRequest(formData: FormData, setupId: number): Promise<EpicSvtTestSetupConfigCreate> {
        const configBody = await FileHelpers.extractFileStringContent(formData.configBody!)
        return {
            setupId,
            name: formData.name || '',
            note: formData.note ?? null,
            configBody,
        }
    }

}
