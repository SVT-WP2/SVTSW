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
    EpicLoaderComponent,
    EpicNoResultModule,
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicWpMachineUpdateForm } from '../../models'

import { EpicWpMachineUpdateFormFactory } from './epic-wp-machine-update-form.factory'

import Form = EpicWpMachineUpdateForm


@Component({
    selector: 'epic-wp-machine-update-form',
    templateUrl: 'epic-wp-machine-update-form.component.html',
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
    ],
})
export class EpicWpMachineUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false

    override formGroup: FormGroup<Form.FormGroupControls>

    readonly FormField = Form.FormField

    protected readonly formFactory = inject(EpicWpMachineUpdateFormFactory)

    protected override initFormGroup() {

        super.initFormGroup()

        if (this.isEditMode) {

            const disallowedFields = [
                Form.FormField.name,
                Form.FormField.serialNumber,
                Form.FormField.vendor,
            ]
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}
