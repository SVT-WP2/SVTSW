import { Component, inject, Input, OnInit } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
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
import {
    EpicFilePickerComponent,
    EpicLoaderComponent,
    EpicNoResultModule,
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicSvtTestTypeConfigCreateFormFactory } from './epic-svt-test-type-config-create-form.factory'
import { EpicSvtTestTypeConfigCreateForm } from './epic-svt-test-type-config-create-form.models'

import Form = EpicSvtTestTypeConfigCreateForm


@Component({
    selector: 'epic-svt-test-type-config-create-form',
    templateUrl: 'epic-svt-test-type-config-create-form.component.html',
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
        EpicFilePickerComponent,
    ],
})
export class EpicSvtTestTypeConfigCreateFormComponent extends BaseFormWithFactoryComponent<Form.FormData,
    FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false

    override formGroup: FormGroup<Form.FormGroupControls>

    readonly FormField = Form.FormField

    protected readonly formFactory = inject(EpicSvtTestTypeConfigCreateFormFactory)

    protected override initFormGroup() {

        super.initFormGroup()

        if (this.isEditMode) {
            const disallowedFields = Object.values(Form.FormField)
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}

