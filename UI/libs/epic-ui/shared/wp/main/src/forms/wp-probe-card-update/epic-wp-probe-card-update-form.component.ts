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
    EpicLoaderComponent,
    EpicNoResultModule,
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicWpProbeCardUpdateForm } from '../../models'

import { EpicWpProbeCardUpdateFormFactory } from './epic-wp-probe-card-update-form.factory'

import Form = EpicWpProbeCardUpdateForm


@Component({
    selector: 'epic-wp-probe-card-update-form',
    templateUrl: 'epic-wp-probe-card-update-form.component.html',
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
    ],
})
export class EpicWpProbeCardUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false

    override formGroup: FormGroup<Form.FormGroupControls>

    readonly FormField = Form.FormField

    protected readonly formFactory = inject(EpicWpProbeCardUpdateFormFactory)

    protected override initFormGroup() {

        super.initFormGroup()

        if (this.isEditMode) {
            const disallowedFields = Object.values(Form.FormField)
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}
