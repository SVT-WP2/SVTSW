import { Component } from '@angular/core'
import { FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms'
import { MatIconButton } from '@angular/material/button'
import {
    MAT_FORM_FIELD_DEFAULT_OPTIONS,
    MatError,
    MatFormField,
    MatFormFieldDefaultOptions,
    MatFormFieldModule,
    MatLabel,
} from '@angular/material/form-field'
import { MatInput, MatInputModule } from '@angular/material/input'
import { EpicIconComponent } from 'epic-ui/common/components'
import { BaseFormComponent } from 'epic-ui/utils'

import { EpicAuthLoginForm } from '../../models'

import Form = EpicAuthLoginForm


@Component({
    selector: 'epic-auth-login-form',
    templateUrl: 'epic-auth-login-form.component.html',
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
        MatIconButton,
        EpicIconComponent,
    ],
})
export class EpicAuthLoginFormComponent extends BaseFormComponent<Form.FormData, FormGroup<Form.FormGroupControls>> {

    readonly formGroup = Form.createFromGroup()
    readonly FormField = Form.FormField

    isPasswordVisible = false

}
