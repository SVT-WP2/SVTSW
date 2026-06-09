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
    EpicLoaderComponent,
    EpicNoResultModule,
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicSvtTestSetupCreateFormFactory } from './epic-svt-test-setup-create-form.factory'
import { EpicSvtTestSetupCreateForm } from './epic-svt-test-setup-create-form.models'

import Form = EpicSvtTestSetupCreateForm


@Component({
    selector: 'epic-svt-test-setup-create-form',
    templateUrl: 'epic-svt-test-setup-create-form.component.html',
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
        EpicFilePickerComponent,
    ],
})
export class EpicSvtTestSetupCreateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false

    override formGroup: FormGroup<Form.FormGroupControls>

    readonly FormField = Form.FormField

    protected readonly formFactory = inject(EpicSvtTestSetupCreateFormFactory)

    protected override initFormGroup() {

        super.initFormGroup()

        if (this.isEditMode) {
            const disallowedFields = Object.values(Form.FormField)
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}
