import { Component, inject } from '@angular/core'
import { FormGroup, ReactiveFormsModule } from '@angular/forms'
import { MatIconButton } from '@angular/material/button'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions, MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { EpicPasswordForm } from 'epic-ui/common/auth'
import { EpicContentErrorModule, EpicIconComponent, EpicLoaderComponent } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicUserCreateForm, EpicUserFormValidators, EpicUsersRules } from '../../models'

import { EpicUserCreateFormFactory } from './epic-user-create-form.factory'

import Form = EpicUserCreateForm


@Component({
    selector: 'epic-user-create-form',
    templateUrl: 'epic-user-create-form.component.html',
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
        MatSelectModule,
        MatIconButton,
        EpicIconComponent,
        EpicLoaderComponent,
        EpicContentErrorModule,
    ],
})
export class EpicUserCreateFormComponent extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>> {

    readonly FormField = Form.FormField
    readonly roles = EpicUsersRules.ROLES
    readonly getFieldErrorText = EpicUserFormValidators.getErrorText
    readonly getPasswordErrorText = EpicPasswordForm.getErrorText

    isPasswordVisible = false

    protected readonly formFactory = inject(EpicUserCreateFormFactory)

}
