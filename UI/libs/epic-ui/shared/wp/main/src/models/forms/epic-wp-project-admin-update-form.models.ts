import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicWaferType, EpicWpMachine, EpicWpProject, EpicWpProjectCreate } from 'epic-ui/api'
import { EpicSelectFormControl, FileHelpers } from 'epic-ui/utils'


export namespace EpicWpProjectAdminUpdateForm {

    export enum FormField {
        wpMachineId = 'wpMachineId',
        waferTypeId = 'waferTypeId',
        name = 'name',
        asicFamilyType = 'asicFamilyType',
        orientation = 'orientation',
        alignmentDie = 'alignmentDie',
        homeDie = 'homeDie',
        local2GlobalMap = 'local2GlobalMap',
    }

    export type FormData = {
        wpMachineId: number
        waferTypeId: number
        name: string
        asicFamilyType: string
        orientation: string
        alignmentDie: string
        homeDie: string
        local2GlobalMap: File // JSON string
    }

    export type FormGroupControls = {
        [FormField.wpMachineId]: EpicSelectFormControl<number, EpicWpMachine>
        [FormField.waferTypeId]: EpicSelectFormControl<number, EpicWaferType>
        [FormField.name]: FormControl<string | null>
        [FormField.asicFamilyType]: EpicSelectFormControl
        [FormField.orientation]: EpicSelectFormControl
        [FormField.alignmentDie]: FormControl<string | null>
        [FormField.homeDie]: FormControl<string | null>
        [FormField.local2GlobalMap]: FormControl<File | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.name]: new FormControl<string | null>(formData?.name || null, Validators.required),
            [FormField.wpMachineId]: new EpicSelectFormControl<number, EpicWpMachine>(formData?.wpMachineId || null, Validators.required),
            [FormField.waferTypeId]: new EpicSelectFormControl<number, EpicWaferType>(formData?.waferTypeId || null, Validators.required),
            [FormField.asicFamilyType]: new EpicSelectFormControl(formData?.asicFamilyType || null, Validators.required),
            [FormField.orientation]: new EpicSelectFormControl(formData?.orientation || null, Validators.required),
            [FormField.alignmentDie]: new FormControl<string | null>(formData?.alignmentDie || null, Validators.required),
            [FormField.homeDie]: new FormControl<string | null>(formData?.homeDie || null, Validators.required),
            [FormField.local2GlobalMap]: new FormControl<File | null>(formData?.local2GlobalMap || null, Validators.required),
        })
    }

    export function toFormData(entity: EpicWpProject): FormData {
        return {
            wpMachineId: entity.wpMachineId,
            waferTypeId: entity.waferTypeId,
            name: entity.name,
            asicFamilyType: entity.asicFamilyType,
            orientation: entity.orientation,
            alignmentDie: entity.alignmentDie,
            homeDie: entity.homeDie,
            local2GlobalMap: FileHelpers.stringContentToJsonFile(entity.local2GlobalMap, 'local-2-global-map.json'),
        }
    }

    export async function formDataToCreateRequest(formData: FormData): Promise<EpicWpProjectCreate> {
        const local2GlobalMap = await FileHelpers.extractFileStringContent(formData.local2GlobalMap)
        return {
            wpMachineId: formData.wpMachineId,
            waferTypeId: formData.waferTypeId,
            name: formData.name,
            asicFamilyType: formData.asicFamilyType,
            orientation: formData.orientation,
            alignmentDie: formData.alignmentDie,
            homeDie: formData.homeDie,
            local2GlobalMap,

        }
    }

}
