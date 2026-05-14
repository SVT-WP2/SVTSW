import { Component, OnInit, signal } from '@angular/core'
import { FormGroup, UntypedFormGroup } from '@angular/forms'
import { catchError, Observable, throwError } from 'rxjs'
import { takeUntil } from 'rxjs/operators'

import { ProcessingStore } from '../../models'

import { BaseFormComponent } from './base-form.component'


export abstract class BaseFormFactory<
    TFormValue extends Record<string, unknown>,
    TFormGroup extends FormGroup = FormGroup,
    TFormOptions extends Record<string, unknown> = Record<string, unknown>> {

    abstract createFormGroup(initFormValue?: Partial<TFormValue>, options?: TFormOptions): Observable<TFormGroup>

}

@Component({
    selector: 'epic-base-form-with-factory',
    template: '',
})
export abstract class BaseFormWithFactoryComponent<TData extends Record<string, unknown> = Record<string, unknown>,
    TFormGroup extends UntypedFormGroup = UntypedFormGroup,
    TOptions extends Record<string, unknown> = Record<string, unknown>>
    extends BaseFormComponent<TData, TFormGroup, TOptions> implements OnInit {

    readonly initProcessing = signal<ProcessingStore.EventProcessingState>(ProcessingStore.getDefaultProcessingState())

    formGroup: TFormGroup

    protected abstract formFactory: BaseFormFactory<TData, TFormGroup>

    override ngOnInit(): void {
        // init form
        this.initProcessing.set(
            ProcessingStore.eventProcessingStart(this.initProcessing()),
        )
        this.formFactory.createFormGroup(this.formData, this.formOptions)
            .pipe(
                catchError((error: Error) => {
                    this.initProcessing.set(
                        ProcessingStore.eventProcessingFinish(this.initProcessing(), error),
                    )
                    return throwError(() => error)
                }),
                takeUntil(this.destroyed$),
            )
            .subscribe((formGroup) => {
                this.formGroup = formGroup
                this.initFormGroup()
                this.initProcessing.set(
                    ProcessingStore.eventProcessingFinish(this.initProcessing()),
                )
            })
    }

}

