import { Component, inject } from '@angular/core'
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
import { MatOption, MatSelect } from '@angular/material/select'
import { EpicLoaderComponent, EpicContentErrorModule } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicChipCreateFormFactory } from './epic-chip-create-form.factory'
import { EpicChipCreateForm } from './epic-chip-create-form.models'

import Form = EpicChipCreateForm


@Component({
    selector: 'epic-chip-create-form',
    templateUrl: 'epic-chip-create-form.component.html',
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
        FormsModule,
        MatSelect,
        MatOption,
        EpicContentErrorModule,
        EpicLoaderComponent,
    ],
})
export class EpicChipCreateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>> {

    readonly FormField = Form.FormField

    protected formFactory = inject(EpicChipCreateFormFactory)

}
