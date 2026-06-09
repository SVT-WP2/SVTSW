import { Component, inject, OnInit } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import {
    MAT_FORM_FIELD_DEFAULT_OPTIONS,
    MatError,
    MatFormField,
    MatFormFieldDefaultOptions,
    MatFormFieldModule,
    MatLabel,
} from '@angular/material/form-field'
import { MatInput, MatInputModule } from '@angular/material/input'
import { EpicLoaderComponent, EpicNoResultModule, EpicContentErrorModule } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicEquipmentTypeUpdateForm } from '../../models'

import { EpicEquipmentTypeUpdateFormFactory } from './epic-equipment-type-update-form.factory'

import Form = EpicEquipmentTypeUpdateForm


@Component({
    selector: 'epic-equipment-type-update-form',
    templateUrl: 'epic-equipment-type-update-form.component.html',
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
    ],
})
export class EpicEquipmentTypeUpdateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>>
    implements OnInit {

    readonly FormField = Form.FormField

    protected readonly formFactory = inject(EpicEquipmentTypeUpdateFormFactory)

}
