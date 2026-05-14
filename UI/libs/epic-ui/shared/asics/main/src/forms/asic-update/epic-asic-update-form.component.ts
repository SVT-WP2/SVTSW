import { Component, inject, Input } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
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
import { MatOption, MatSelect } from '@angular/material/select'
import {
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicNoResultModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent, EpicSearchPipe } from 'epic-ui/utils'
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search'

import { EpicAsicUpdateForm } from '../../models'

import { EpicAsicUpdateFormFactory } from './epic-asic-update-form.factory'

import Form = EpicAsicUpdateForm


@Component({
    selector: 'epic-asic-update-form',
    templateUrl: 'epic-asic-update-form.component.html',
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
        MatSelect,
        MatOption,
        NgxMatSelectSearchModule,
        EpicSearchPipe,
        EpicContentErrorModule,
        EpicLoaderComponent,
        EpicNoResultModule,
    ],
})
export class EpicAsicUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>> {

    @Input() isEditMode = false

    readonly FormField = Form.FormField
    readonly waferSearchTermControl = new FormControl<string>('')

    protected formFactory = inject(EpicAsicUpdateFormFactory)

    protected override initFormGroup() {
        super.initFormGroup()

        if (this.isEditMode) {
            const disallowedFields = [
                Form.FormField.serialNumber,
                Form.FormField.waferId,
                Form.FormField.familyType,
                Form.FormField.waferMapPosition,
            ]
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}
