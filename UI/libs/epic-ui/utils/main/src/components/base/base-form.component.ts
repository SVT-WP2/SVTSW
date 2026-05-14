import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core'
import { FormControlStatus, UntypedFormGroup } from '@angular/forms'
import { takeUntil } from 'rxjs/operators'

import { BaseComponent, IBaseComponent } from './base.component'


export interface IEpicFormComponent<TData extends Record<string, unknown> = Record<string, unknown>,
    TOptions extends Record<string, unknown> = Record<string, unknown>,
    TFormGroup extends UntypedFormGroup = UntypedFormGroup> extends IBaseComponent {

    formGroup: TFormGroup
    formOptions: TOptions | undefined
    formData: Partial<TData> | undefined

    dataChanged$: EventEmitter<TData>

    readonly currentFormData: TData
}

@Component({
    selector: 'epic-base-form',
    template: '',
})
export abstract class BaseFormComponent<TData extends Record<string, unknown> = Record<string, unknown>,
    TFormGroup extends UntypedFormGroup = UntypedFormGroup,
    TOptions extends Record<string, unknown> = Record<string, unknown>>
    extends BaseComponent implements IEpicFormComponent<TData, TOptions, TFormGroup>, OnInit {

    @Input() formOptions: TOptions | undefined
    @Input() formData: Partial<TData> | undefined

    @Output() dataChanged$ = new EventEmitter<TData>()
    @Output() statusChanged$ = new EventEmitter<FormControlStatus>()
    @Output() formGroupReady$ = new EventEmitter<TFormGroup>()

    abstract formGroup: TFormGroup

    ngOnInit(): void {
        this.initFormGroup()
    }

    protected initFormGroup(): void {
        this.formGroup.setValue({
            ...this.formGroup.value,
            ...(this.formData || {}),
        })

        this.initFormValueChanges()

        this.formGroup.statusChanges
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                this.statusChanged$
                    .emit(
                        this.currentFormStatus,
                    )
            })

        this.formGroupReady$.emit(this.formGroup)
    }

    protected initFormValueChanges(): void {
        this.formGroup.valueChanges
            .pipe(
                takeUntil(this.destroyed$),
            )
            .subscribe(() => {
                this.dataChanged$
                    .emit(
                        this.currentFormData,
                    )
            })
    }

    get currentFormData(): TData {
        return this.formGroup.getRawValue() as TData
    }

    get currentFormStatus(): FormControlStatus {
        return this.formGroup.status
    }

}

