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
import { MatInputModule } from '@angular/material/input'
import { MatOption, MatSelect } from '@angular/material/select'
import { EpicFilePickerComponent, EpicLoaderComponent, EpicAlertModule, EpicContentErrorModule } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicChipCreateWithFileFormFactory } from './epic-chip-create-with-file-form.factory'
import { EpicChipCreateWithFileForm } from './epic-chip-create-with-file-form.models'

import Form = EpicChipCreateWithFileForm


@Component({
    selector: 'epic-chip-create-with-file-form',
    templateUrl: 'epic-chip-create-with-file-form.component.html',
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
        MatLabel,
        MatError,
        MatFormFieldModule,
        MatInputModule,
        FormsModule,
        MatSelect,
        MatOption,
        EpicContentErrorModule,
        EpicLoaderComponent,
        EpicFilePickerComponent,
        EpicAlertModule,
    ],
})
export class EpicChipCreateWithFileFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>> {

    readonly FormField = Form.FormField

    protected formFactory = inject(EpicChipCreateWithFileFormFactory)

}
