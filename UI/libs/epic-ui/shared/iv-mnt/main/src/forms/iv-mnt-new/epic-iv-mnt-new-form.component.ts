import { Component } from '@angular/core'
import { FormGroup, ReactiveFormsModule } from '@angular/forms'
import { MatDivider } from '@angular/material/divider'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormField, MatFormFieldDefaultOptions, MatLabel } from '@angular/material/form-field'
import { MatInput } from '@angular/material/input'
import { BaseFormComponent } from 'epic-ui/utils'

import { EpicIvMntNewForm } from '../../models'

import Form = EpicIvMntNewForm


@Component({
    selector: 'epic-iv-mnt-new-form',
    templateUrl: 'epic-iv-mnt-new-form.component.html',
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
        MatDivider,
    ],
})
export class EpicIvMntNewFormComponent extends BaseFormComponent<Form.FormValue, FormGroup<Form.FormGroupControls>> {

    readonly formGroup = Form.createFromGroup()
    readonly FormField = Form.FormField

}
