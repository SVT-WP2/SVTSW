import { Component } from '@angular/core'
import { FormGroup, ReactiveFormsModule } from '@angular/forms'
import { MatIconButton } from '@angular/material/button'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions, MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { EpicIconComponent } from 'epic-ui/common/components'
import { BaseFormComponent } from 'epic-ui/utils'

import { EpicAuthPasswordChangeForm, EpicPasswordForm } from '../../models'

import Form = EpicAuthPasswordChangeForm


@Component({
    selector: 'epic-auth-password-change-form',
    templateUrl: 'epic-auth-password-change-form.component.html',
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
        MatFormFieldModule,
        MatInputModule,
        MatIconButton,
        EpicIconComponent,
    ],
})
export class EpicAuthPasswordChangeFormComponent extends BaseFormComponent<Form.FormData, FormGroup<Form.FormGroupControls>> {

    readonly formGroup = Form.createFromGroup()
    readonly FormField = Form.FormField
    readonly getErrorText = EpicPasswordForm.getErrorText

    isPasswordVisible = false

}
