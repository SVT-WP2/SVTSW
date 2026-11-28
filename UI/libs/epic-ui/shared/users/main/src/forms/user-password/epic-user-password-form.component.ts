import { Component, inject } from '@angular/core'
import { FormGroup, ReactiveFormsModule } from '@angular/forms'
import { MatIconButton } from '@angular/material/button'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions, MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { EpicPasswordForm } from 'epic-ui/common/auth'
import { EpicContentErrorModule, EpicIconComponent, EpicLoaderComponent } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicUserPasswordForm } from '../../models'

import { EpicUserPasswordFormFactory } from './epic-user-password-form.factory'

import Form = EpicUserPasswordForm


@Component({
    selector: 'epic-user-password-form',
    templateUrl: 'epic-user-password-form.component.html',
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
        EpicLoaderComponent,
        EpicContentErrorModule,
    ],
})
export class EpicUserPasswordFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>> {

    readonly FormField = Form.FormField
    readonly getErrorText = EpicPasswordForm.getErrorText

    isPasswordVisible = false

    protected readonly formFactory = inject(EpicUserPasswordFormFactory)

}
