import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicSvtTestTemplate, EpicSvtTestTemplateCreate, EpicSvtTestType, EpicSvtTestTypeConfig } from 'epic-ui/api'
import { EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicSvtTestTemplateUpdateForm {

    export type FormData = {
        dutType: string
        testTypeId: number
        testTypeConfigId: number
        isEnabled: boolean
    }

    export const FormField: Record<keyof FormData, keyof FormData> = {
        dutType: 'dutType',
        testTypeId: 'testTypeId',
        testTypeConfigId: 'testTypeConfigId',
        isEnabled: 'isEnabled',
    }

    export type FormGroupControls = {
        dutType: EpicSelectFormControl
        testTypeId: EpicSelectFormControl<number | null, EpicSvtTestType>
        testTypeConfigId: EpicSelectFormControl<number | null, EpicSvtTestTypeConfig>
        isEnabled: FormControl<boolean | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup<FormGroupControls>({
            dutType: new EpicSelectFormControl(formData?.dutType || null, Validators.required),
            testTypeId: new EpicSelectFormControl<number | null, EpicSvtTestType>(
                formData?.testTypeId ?? null, Validators.required,
            ),
            testTypeConfigId: new EpicSelectFormControl<number | null, EpicSvtTestTypeConfig>(
                formData?.testTypeConfigId ?? null, Validators.required,
            ),
            isEnabled: new FormControl<boolean | null>(formData?.isEnabled ?? true, Validators.required),
        })
    }

    export function toFormData(entity: EpicSvtTestTemplate): FormData {
        return {
            dutType: entity.dutType,
            testTypeId: entity.testTypeId,
            testTypeConfigId: entity.testTypeConfigId,
            isEnabled: entity.isEnabled,
        }
    }

    export function formDataToCreate(formData: FormData): EpicSvtTestTemplateCreate {
        return {
            dutType: formData.dutType,
            testTypeConfigId: formData.testTypeConfigId,
            isEnabled: formData.isEnabled,
        }
    }

}

