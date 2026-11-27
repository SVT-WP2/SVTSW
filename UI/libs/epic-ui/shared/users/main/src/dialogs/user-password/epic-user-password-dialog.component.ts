import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicIconComponent, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicUserPasswordFormComponent } from '../../forms'
import { EpicUserDialogs, EpicUserPasswordForm } from '../../models'

import Form = EpicUserPasswordForm


@Component({
    selector: 'epic-user-password-dialog',
    templateUrl: './epic-user-password-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicUserPasswordFormComponent,
    ],
})
export class EpicUserPasswordDialogComponent extends BaseFormDialogComponent<Form.FormData> {

    readonly dialogData = inject<EpicUserDialogs.PasswordData>(MAT_DIALOG_DATA)

    formGroup: FormGroup<Form.FormGroupControls> | null = null

    onFormGroupReady(formGroup: FormGroup<Form.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
