import { Component, EventEmitter, Input, Output } from '@angular/core'
import { UntypedFormGroup } from '@angular/forms'

import { EpicRecord } from '../../models'

import { BaseComponent, IBaseComponent } from './base.component'


export interface IFormDialogComponent<TData extends EpicRecord = EpicRecord, TFormGroup extends UntypedFormGroup = UntypedFormGroup>
    extends IBaseComponent {

    isProcessing: boolean
    processingError: string | null

    submit$: EventEmitter<TData>

    onSubmitBtnClicked(formGroup: TFormGroup): void
}

@Component({
    selector: 'epic-base-form-dialog',
    template: '',
    standalone: false,
})
export abstract class BaseFormDialogComponent<TData extends EpicRecord = EpicRecord,
    TFormGroup extends UntypedFormGroup = UntypedFormGroup>
    extends BaseComponent implements IFormDialogComponent<TData, TFormGroup> {

    @Input() isProcessing = false
    @Input() processingError: string | null = null

    @Output() submit$ = new EventEmitter<TData>()

    onSubmitBtnClicked(formGroup: TFormGroup): void {
        this.processingError = null
        const data = this.extractData(formGroup)
        this.submit$.emit(data)
    }

    protected extractData(formGroup: TFormGroup): TData {
        return formGroup.getRawValue() as TData
    }

}

