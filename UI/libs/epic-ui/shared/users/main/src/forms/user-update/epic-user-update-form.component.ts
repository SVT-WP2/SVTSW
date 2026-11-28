import { Component, inject } from '@angular/core'
import { FormGroup, ReactiveFormsModule } from '@angular/forms'
import { MAT_FORM_FIELD_DEFAULT_OPTIONS, MatFormFieldDefaultOptions, MatFormFieldModule } from '@angular/material/form-field'
import { MatInputModule } from '@angular/material/input'
import { MatSelectModule } from '@angular/material/select'
import { EpicContentErrorModule, EpicLoaderComponent } from 'epic-ui/common/components'
import { BaseFormWithFactoryComponent } from 'epic-ui/utils'

import { EpicUserFormValidators, EpicUsersRules, EpicUserUpdateForm } from '../../models'

import { EpicUserUpdateFormFactory } from './epic-user-update-form.factory'

import Form = EpicUserUpdateForm


@Component({
    selector: 'epic-user-update-form',
    templateUrl: 'epic-user-update-form.component.html',
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
        EpicLoaderComponent,
        EpicContentErrorModule,
    ],
})
export class EpicUserUpdateFormComponent
    extends BaseFormWithFactoryComponent<Form.FormData, FormGroup<Form.FormGroupControls>, Form.FormOptions> {

    readonly FormField = Form.FormField
    readonly roles = EpicUsersRules.ROLES
    readonly ownUserHint = EpicUsersRules.OWN_USER_HINT
    readonly getFieldErrorText = EpicUserFormValidators.getErrorText

    protected readonly formFactory = inject(EpicUserUpdateFormFactory)

}
