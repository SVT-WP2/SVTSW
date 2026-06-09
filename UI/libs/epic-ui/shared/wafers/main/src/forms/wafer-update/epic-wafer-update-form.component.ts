import { Component, inject, Input, OnInit } from '@angular/core'
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatCard, MatCardContent } from '@angular/material/card'
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
import { MatSelectModule } from '@angular/material/select'
import { MatSlideToggle } from '@angular/material/slide-toggle'
import {
    EpicChipsAutocompleteFormControlModule,
    EpicContentErrorModule,
    EpicLoaderComponent,
    EpicNoResultModule,
} from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent, EpicSearchPipe } from 'epic-ui/utils'
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search'

import { EpicWaferUpdateForm } from '../../models'

import { EpicWaferUpdateFormFactory } from './epic-wafer-update-form.factory'

import Form = EpicWaferUpdateForm


@Component({
    selector: 'epic-wafer-update-form',
    templateUrl: 'epic-wafer-update-form.component.html',
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
        FormsModule,
        ReactiveFormsModule,
        MatFormField,
        MatInput,
        MatLabel,
        MatError,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatSlideToggle,
        MatCard,
        MatCardContent,
        MatSelectModule,
        EpicChipsAutocompleteFormControlModule,
        EpicContentErrorModule,
        EpicLoaderComponent,
        NgxMatSelectSearchModule,
        EpicSearchPipe,
        EpicNoResultModule,
    ],
})
export class EpicWaferUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    @Input() isEditMode = false

    readonly FormField = Form.FormField
    readonly waferTypeSearchTermControl = new FormControl<string>('')

    // DI
    protected formFactory = inject(EpicWaferUpdateFormFactory)

    protected override initFormGroup() {
        super.initFormGroup()

        if (this.isEditMode) {
            const disallowedFields = [
                Form.FormField.waferType,
                Form.FormField.serialNumber,
                Form.FormField.batchNumber,
                Form.FormField.generalLocation,
            ]
            disallowedFields.forEach(field => this.formGroup.controls[field].disable())
        }
    }

}
