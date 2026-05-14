import { FormControl, FormGroup, Validators } from '@angular/forms'
import { EpicWpProbeCard, EpicWpProbeCardCreate, EpicWpProbeCardUpdate } from 'epic-ui/api'
import { omit } from 'lodash-es'
import moment from 'moment/moment'


export namespace EpicWpProbeCardUpdateForm {

    export enum FormField {
        name = 'name',
        serialNumber = 'serialNumber',
        model = 'model',
        arriveDate = 'arriveDate',
        location = 'location',
        vendor = 'vendor',
        type = 'type',
        vendorCleaningInterval = 'vendorCleaningInterval',
    }

    export type FormData = {
        serialNumber: string
        name: string
        vendor: string
        model: string
        arriveDate: string
        location: string
        type: string
        vendorCleaningInterval: number
    }

    export type FormGroupControls = {
        [FormField.name]: FormControl<string | null>
        [FormField.serialNumber]: FormControl<string | null>
        [FormField.model]: FormControl<string | null>
        [FormField.arriveDate]: FormControl<string | null>
        [FormField.location]: FormControl<string | null>
        [FormField.vendor]: FormControl<string | null>
        [FormField.type]: FormControl<string | null>
        [FormField.vendorCleaningInterval]: FormControl<number | null>
    }

    export function createFromGroup(formData?: Partial<FormData>): FormGroup<FormGroupControls> {
        return new FormGroup({
            [FormField.name]: new FormControl<string | null>(formData?.name || null, Validators.required),
            [FormField.serialNumber]: new FormControl<string | null>(formData?.serialNumber || null, Validators.required),
            [FormField.model]: new FormControl<string | null>(formData?.model || null, Validators.required),
            [FormField.arriveDate]: new FormControl<string | null>(formData?.arriveDate || null, Validators.required),
            [FormField.location]: new FormControl<string | null>(formData?.location || null, Validators.required),
            [FormField.vendor]: new FormControl<string | null>(formData?.vendor || null, Validators.required),
            [FormField.type]: new FormControl<string | null>(formData?.vendor || null, Validators.required),
            [FormField.vendorCleaningInterval]: new FormControl<number | null>(
                formData?.vendorCleaningInterval || null, Validators.required,
            ),
        })
    }

    export function toFormData(entity: EpicWpProbeCard): FormData {
        return {
            ...omit(entity, 'id'),
        }
    }

    export function formDataToCreateRequest(formData: FormData): EpicWpProbeCardCreate {
        return {
            ...omit(formData, 'id'),
            arriveDate: formData.arriveDate ? moment(formData.arriveDate).format('YYYY-MM-DD') : '',
        }
    }

    export function formDataToUpdateRequest(formData: FormData): EpicWpProbeCardUpdate {
        return {
            location: formData.location,
            vendorCleaningInterval: formData.vendorCleaningInterval,
        }
    }


}
