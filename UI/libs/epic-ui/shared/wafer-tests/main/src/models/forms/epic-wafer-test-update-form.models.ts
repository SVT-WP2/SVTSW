import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicAsicTestType, EpicWafer, EpicWaferTest, EpicWaferTestCreate, EpicWaferTestUpdate, EpicWpMachine } from 'epic-ui/api'
import { EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicWaferTestUpdateForm {

    export enum FormField {
        name = 'name',
        allowCustomName = 'allowCustomName',
        description = 'description',
        wpMachineId = 'wpMachineId',
        waferId = 'waferId',
        asicTestTypeId = 'asicTestTypeId',
        asicIds = 'asicIds',
        testConfig = 'testConfig',
    }

    export type FormData = {
        name: string
        allowCustomName: boolean
        description: string | null
        wpMachineId: number
        waferId: number
        asicTestTypeId: number
        asicIds: number[]
        testConfig: {
            skipInitialAlignment: boolean
            skipPtpaForEachStep: boolean
            voltage: number | null
        }
    }

    export type FormGroupControls = {
        [FormField.name]: FormControl<string | null>
        [FormField.allowCustomName]: FormControl<boolean | null>
        [FormField.description]: FormControl<string | null>
        [FormField.wpMachineId]: EpicSelectFormControl<number, EpicWpMachine>
        [FormField.waferId]: EpicSelectFormControl<number, EpicWafer>
        [FormField.asicTestTypeId]: EpicSelectFormControl<number, EpicAsicTestType>
        [FormField.asicIds]: FormControl<number[] | null>
        [FormField.testConfig]: FormGroup<{
            skipInitialAlignment: FormControl<boolean | null>
            skipPtpaForEachStep: FormControl<boolean | null>
            voltage: FormControl<number | null>
        }>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.name]: new FormControl<string | null>(formData?.name || 'Wafer - Test Type'),
            [FormField.allowCustomName]: new FormControl<boolean | null>(!!formData?.name?.length),
            [FormField.description]: new FormControl<string | null>(formData?.description || null),
            [FormField.asicIds]: new FormControl<number[]>(formData?.asicIds || []),
            [FormField.wpMachineId]: new EpicSelectFormControl<number, EpicWpMachine>(
                formData?.wpMachineId || null, [Validators.required],
            ),
            [FormField.waferId]: new EpicSelectFormControl<number, EpicWafer>(
                formData?.waferId || null, [Validators.required],
            ),
            [FormField.asicTestTypeId]: new EpicSelectFormControl<number, EpicAsicTestType>(
                formData?.asicTestTypeId || null, [Validators.required],
            ),
            [FormField.testConfig]: new FormGroup({
                skipInitialAlignment: new FormControl<boolean>(formData?.testConfig?.skipInitialAlignment || false),
                skipPtpaForEachStep: new FormControl<boolean>(formData?.testConfig?.skipPtpaForEachStep || false),
                voltage: new FormControl<number>(formData?.testConfig?.voltage || 10),
            }),
        })
    }

    export function toFormData(entity: EpicWaferTest): FormData {
        return {
            name: entity.name,
            allowCustomName: !!entity?.name?.length,
            description: entity.description,
            wpMachineId: entity.wpMachineId,
            waferId: entity.waferId,
            asicTestTypeId: entity.asicTestTypeId,
            asicIds: entity.asicIds,
            testConfig: {
                skipInitialAlignment: entity.testConfig?.skipInitialAlignment || false,
                skipPtpaForEachStep: entity.testConfig?.skipPtpaForEachStep || false,
                voltage: entity.testConfig?.voltage || null,
            },
        }
    }

    export function formDataToUpdateRequest(formData: FormData): EpicWaferTestUpdate {
        return {
            name: formData.name,
            description: formData.description,
        }
    }

    export function formDataToCreateRequest(formData: FormData): EpicWaferTestCreate {
        return {
            name: formData.name,
            description: formData.description,
            wpMachineId: formData.wpMachineId,
            waferId: formData.waferId,
            asicTestTypeId: formData.asicTestTypeId,
            asicIds: formData.asicIds,
            testConfig: formData.testConfig,
        }
    }


}
