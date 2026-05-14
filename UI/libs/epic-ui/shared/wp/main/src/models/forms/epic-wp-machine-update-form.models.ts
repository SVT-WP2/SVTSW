import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicWpMachine, EpicWpMachineCreate, EpicWpMachineUpdate } from 'epic-ui/api'
import { EpicSelectFormControl } from 'epic-ui/utils'


export namespace EpicWpMachineUpdateForm {

    export enum FormField {
        name = 'name',
        serialNumber = 'serialNumber',
        hostName = 'hostName',
        connectionType = 'connectionType',
        connectionPort = 'connectionPort',
        generalLocation = 'generalLocation',
        software = 'software',
        swVersion = 'swVersion',
        vendor = 'vendor',
    }

    export type FormData = {
        name: string
        serialNumber: string
        hostName: string
        connectionType: string
        connectionPort: number
        generalLocation: string
        software: string
        swVersion: string
        vendor: string
    }

    export type FormGroupControls = {
        [FormField.name]: FormControl<string | null>
        [FormField.serialNumber]: FormControl<string | null>
        [FormField.hostName]: FormControl<string | null>
        [FormField.connectionType]: EpicSelectFormControl
        [FormField.connectionPort]: FormControl<number | null>
        [FormField.generalLocation]: EpicSelectFormControl
        [FormField.software]: EpicSelectFormControl
        [FormField.swVersion]: FormControl<string | null>
        [FormField.vendor]: EpicSelectFormControl
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.name]: new FormControl<string | null>(formData?.name || null, Validators.required),
            [FormField.serialNumber]: new FormControl<string | null>(formData?.serialNumber || null, Validators.required),
            [FormField.hostName]: new FormControl<string | null>(formData?.hostName || null, Validators.required),
            [FormField.connectionType]: new EpicSelectFormControl(formData?.connectionType || null, Validators.required),
            [FormField.connectionPort]: new FormControl<number | null>(formData?.connectionPort || null, Validators.required),
            [FormField.generalLocation]: new EpicSelectFormControl(formData?.generalLocation || null, Validators.required),
            [FormField.software]: new EpicSelectFormControl(formData?.software || null, Validators.required),
            [FormField.swVersion]: new FormControl<string | null>(formData?.swVersion || null, Validators.required),
            [FormField.vendor]: new EpicSelectFormControl(formData?.vendor || null, Validators.required),
        })
    }

    export function toFormData(entity: EpicWpMachine): FormData {
        return {
            name: entity.name,
            serialNumber: entity.serialNumber,
            hostName: entity.hostName,
            connectionType: entity.connectionType,
            connectionPort: entity.connectionPort,
            generalLocation: entity.generalLocation,
            software: entity.software,
            swVersion: entity.swVersion,
            vendor: entity.vendor,
        }
    }

    export function formDataToCreateRequest(formData: FormData): EpicWpMachineCreate {
        return {
            name: formData.name,
            serialNumber: formData.serialNumber,
            hostName: formData.hostName,
            connectionType: formData.connectionType,
            connectionPort: formData.connectionPort,
            generalLocation: formData.generalLocation,
            software: formData.software,
            swVersion: formData.swVersion,
            vendor: formData.vendor,
        }
    }

    export function formDataToUpdateRequest(formData: FormData): EpicWpMachineUpdate {
        return {
            hostName: formData.hostName,
            connectionType: formData.connectionType,
            connectionPort: formData.connectionPort,
            generalLocation: formData.generalLocation,
            software: formData.software,
            swVersion: formData.swVersion,
        }
    }


}
