import { Component, inject, Input, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import {
    MAT_FORM_FIELD_DEFAULT_OPTIONS,
    MatError,
    MatFormField,
    MatFormFieldDefaultOptions,
    MatFormFieldModule,
    MatLabel,
} from '@angular/material/form-field'
import { MatInput, MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { EpicFilePickerComponent, EpicLoaderComponent, EpicNoResultModule, EpicContentErrorModule } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent, EpicSearchPipe } from 'epic-ui/utils'
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search'

import { EpicEquipmentUpdateForm } from '../../models'

import { EpicEquipmentUpdateFormFactory } from './epic-equipment-update-form.factory'

import Form = EpicEquipmentUpdateForm


@Component({
    selector: 'epic-equipment-update-form',
    templateUrl: 'epic-equipment-update-form.component.html',
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
        FormsModule,
        EpicLoaderComponent,
        EpicContentErrorModule,
        EpicNoResultModule,
        EpicSearchPipe,
        MatSelectModule,
        NgxMatSelectSearchModule,
        EpicFilePickerComponent,
    ],
})
export class EpicEquipmentUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false
    
    readonly FormField = Form.FormField
    readonly equipmentTypeIdSearchTermControl = new FormControl<string>('')

    protected readonly formFactory = inject(EpicEquipmentUpdateFormFactory)

    protected override initFormGroup() {
        super.initFormGroup()

        if (this.isEditMode) {
            const disallowedFields = Object.values(Form.FormField)
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}
