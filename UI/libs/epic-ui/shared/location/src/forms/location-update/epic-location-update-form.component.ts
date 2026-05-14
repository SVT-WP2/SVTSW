import { Component, inject, OnInit } from '@angular/core'
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
import { MatSelectModule } from '@angular/material/select'
import { EpicLoaderComponent, EpicChipsAutocompleteFormControlModule, EpicContentErrorModule } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'
import { NgxMatSelectSearchModule } from 'ngx-mat-select-search'

import { EpicLocationUpdateFormFactory } from './epic-location-update-form.factory'
import { EpicLocationUpdateForm } from './epic-location-update-form.models'

import Form = EpicLocationUpdateForm


@Component({
    selector: 'epic-location-update-form',
    templateUrl: 'epic-location-update-form.component.html',
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
        MatSelectModule,
        EpicChipsAutocompleteFormControlModule,
        EpicContentErrorModule,
        EpicLoaderComponent,
        NgxMatSelectSearchModule,
    ],
})
export class EpicLocationUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>,
    Form.FormOptions>
    implements OnInit {

    readonly FormField = Form.FormField

    // DI
    protected formFactory = inject(EpicLocationUpdateFormFactory)

}
