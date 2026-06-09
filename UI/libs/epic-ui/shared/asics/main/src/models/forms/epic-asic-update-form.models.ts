import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicAsic, EpicAsicCreate, EpicAsicUpdate } from 'epic-ui/api'
import { EpicWaferRef } from 'epic-ui/shared/wafers'
import { EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicAsicUpdateForm {

    export enum FormField {
        serialNumber = 'serialNumber',
        waferId = 'waferId',
        familyType = 'familyType',
        waferMapPosition = 'waferMapPosition',
        quality = 'quality',
    }

    export type FormData = {
        serialNumber: string
        waferId: number | null
        familyType: string
        waferMapPosition: string
        quality: string
    }

    export type FormGroupControls = {
        [FormField.serialNumber]: FormControl<string | null>
        [FormField.waferId]: EpicSelectFormControl<number, EpicWaferRef>
        [FormField.familyType]: EpicSelectFormControl
        [FormField.waferMapPosition]: FormControl<string | null>
        [FormField.quality]: EpicSelectFormControl
    }

    export function createFromGroup(initFormData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.serialNumber]: new FormControl<string | null>(initFormData?.serialNumber || null, Validators.required),
            [FormField.waferId]: new EpicSelectFormControl<number, EpicWaferRef>(initFormData?.waferId || null, [Validators.required]),
            [FormField.familyType]: new EpicSelectFormControl(initFormData?.familyType || null, [Validators.required]),
            [FormField.waferMapPosition]: new FormControl<string | null>(initFormData?.waferMapPosition || null, [Validators.required]),
            [FormField.quality]: new EpicSelectFormControl(initFormData?.quality || null, [Validators.required]),
        })
    }

    export function toFormData(asic: EpicAsic): FormData {
        return {
            serialNumber: asic.serialNumber,
            waferId: asic.waferId,
            familyType: asic.familyType,
            waferMapPosition: asic.waferMapPosition,
            quality: asic.quality,
        }
    }

    export function formDataToUpdateRequest(formData: FormData): EpicAsicUpdate {
        return {
            waferMapPosition: formData.waferMapPosition,
        }
    }

    export function formDataToCreateRequest(formData: FormData): EpicAsicCreate {
        return {
            serialNumber: formData.serialNumber,
            waferId: formData.waferId!,
            familyType: formData.familyType,
            waferMapPosition: formData.waferMapPosition,
            quality: formData.quality,
        }
    }


}
