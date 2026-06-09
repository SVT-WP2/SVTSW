import { Component, inject, Input, OnInit } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatOption } from '@angular/material/core'
import { MatDatepickerModule } from '@angular/material/datepicker'
import {
    MAT_FORM_FIELD_DEFAULT_OPTIONS,
    MatError,
    MatFormField,
    MatFormFieldDefaultOptions,
    MatFormFieldModule,
    MatLabel,
} from '@angular/material/form-field'
import { MatInput, MatInputModule } from '@angular/material/input'
import { MatSelect } from '@angular/material/select'
import {
    EpicFilePickerComponent,
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicNoResultModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search'

import { EpicWaferTypeUpdateForm } from '../../models'

import { EpicWaferTypeUpdateFormFactory } from './epic-wafer-type-update-form.factory'

import Form = EpicWaferTypeUpdateForm


@Component({
    selector: 'epic-wafer-type-update-form',
    templateUrl: 'epic-wafer-type-update-form.component.html',
    standalone: true,
    providers: [
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: {
                appearance: 'outline',
                floatLabel: 'always',
                subscriptSizing: 'dynamic',
            } as MatFormFieldDefaultOptions,
        },
    ],
    imports: [
        ReactiveFormsModule,
        MatFormField,
        MatInput,
        MatLabel,
        MatError,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        EpicChipsAutocompleteFormControlModule,
        FormsModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicNoResultModule,
        MatOption,
        MatSelect,
        NgxMatSelectSearchModule,
        EpicFilePickerComponent,
    ],
})
export class EpicWaferTypeUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false

    override formGroup: FormGroup<Form.FormGroupControls>

    readonly FormField = Form.FormField

    protected readonly formFactory = inject(EpicWaferTypeUpdateFormFactory)

    protected override initFormGroup() {

        super.initFormGroup()

        if (this.isEditMode) {
            const disallowedFields = [
                Form.FormField.engineeringRun,
                Form.FormField.foundry,
                Form.FormField.technology,
            ]
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}
