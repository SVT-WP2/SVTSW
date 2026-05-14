import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicWafer, EpicWaferCreate, EpicWaferUpdate } from 'epic-ui/api'
import { EpicSelectFormControl } from 'epic-ui/utils'
import moment from 'moment'

import { EpicWaferTypeRef } from '../epic-wafer-type-ref.models'


export namespace EpicWaferUpdateForm {

    export enum FormField {
        waferType = 'waferType',
        serialNumber = 'serialNumber',
        batchNumber = 'batchNumber',
        generalLocation = 'generalLocation',
        thinningDate = 'thinningDate',
        dicingDate = 'dicingDate',
        productionDate = 'productionDate',
        allowProductionDate = 'allowProductionDate',
        allowDicingDate = 'allowDicingDate',
        allowThinningDate = 'allowThinningDate',
    }

    export type FormData = {
        waferType: number
        serialNumber: string
        batchNumber: number
        generalLocation: string | null
        thinningDate: string | null
        dicingDate: string | null
        productionDate: string | null
        allowProductionDate: boolean
        allowDicingDate: boolean
        allowThinningDate: boolean
    }

    export type FormGroupControls = {
        [FormField.waferType]: EpicSelectFormControl<number | null, EpicWaferTypeRef>
        [FormField.serialNumber]: FormControl<string | null>
        [FormField.batchNumber]: FormControl<number | null>
        [FormField.generalLocation]: EpicSelectFormControl
        [FormField.thinningDate]: FormControl<string | null>
        [FormField.dicingDate]: FormControl<string | null>
        [FormField.productionDate]: FormControl<string | null>
        [FormField.allowProductionDate]: FormControl<boolean | null>
        [FormField.allowDicingDate]: FormControl<boolean | null>
        [FormField.allowThinningDate]: FormControl<boolean | null>
    }

    export function createFromGroup(initFormData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.waferType]: new EpicSelectFormControl<number | null, EpicWaferTypeRef>(null, [Validators.required]),
            [FormField.serialNumber]: new FormControl<string | null>(null, Validators.required),
            [FormField.batchNumber]: new FormControl<number | null>(null, [Validators.required, Validators.min(0)]),
            [FormField.generalLocation]: new EpicSelectFormControl('', [Validators.required]),
            [FormField.thinningDate]: new FormControl<string | null>(null, []),
            [FormField.dicingDate]: new FormControl<string | null>(null, []),
            [FormField.productionDate]: new FormControl<string | null>(null, []),
            [FormField.allowProductionDate]: new FormControl<boolean>(false, []),
            [FormField.allowDicingDate]: new FormControl<boolean>(false, []),
            [FormField.allowThinningDate]: new FormControl<boolean>(false, []),
        })
    }

    export function toFormData(wafer: EpicWafer): FormData {
        return {
            waferType: wafer.waferTypeId,
            serialNumber: wafer.serialNumber,
            batchNumber: wafer.batchNumber,
            generalLocation: wafer.generalLocation,
            thinningDate: wafer.thinningDate,
            dicingDate: wafer.dicingDate,
            productionDate: wafer.productionDate,
            allowProductionDate: !!wafer.productionDate,
            allowDicingDate: !!wafer.dicingDate,
            allowThinningDate: !!wafer.thinningDate,
        }
    }

    export function formDataToUpdateRequest(formData: FormData): EpicWaferUpdate {
        return {
            thinningDate: formData.allowThinningDate ? moment(formData.thinningDate).format('YYYY-MM-DD') : null,
            dicingDate: formData.allowDicingDate ? moment(formData.dicingDate).format('YYYY-MM-DD') : null,
            productionDate: formData.allowProductionDate ? moment(formData.productionDate).format('YYYY-MM-DD') : null,
        }
    }

    export function formDataToCreateRequest(formData: FormData): EpicWaferCreate {
        return {
            waferTypeId: formData.waferType,
            serialNumber: formData.serialNumber,
            batchNumber: formData.batchNumber,
            generalLocation: formData.generalLocation,
            thinningDate: formData.allowThinningDate ? moment(formData.thinningDate).format('YYYY-MM-DD') : null,
            dicingDate: formData.allowDicingDate ? moment(formData.dicingDate).format('YYYY-MM-DD') : null,
            productionDate: formData.allowProductionDate ? moment(formData.productionDate).format('YYYY-MM-DD') : null,
        }
    }


}
