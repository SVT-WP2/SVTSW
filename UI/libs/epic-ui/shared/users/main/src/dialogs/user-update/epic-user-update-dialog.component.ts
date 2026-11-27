import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicIconComponent, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicUserUpdateFormComponent } from '../../forms'
import { EpicUserDialogs, EpicUserUpdateForm } from '../../models'

import Form = EpicUserUpdateForm


@Component({
    selector: 'epic-user-update-dialog',
    templateUrl: './epic-user-update-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicUserUpdateFormComponent,
    ],
})
export class EpicUserUpdateDialogComponent extends BaseFormDialogComponent<Form.FormData> {

    readonly dialogData = inject<EpicUserDialogs.UpdateData>(MAT_DIALOG_DATA)

    readonly formData = Form.toFormData(this.dialogData.user)
    readonly formOptions: Form.FormOptions = { login: this.dialogData.user.login, isOwnUser: this.dialogData.isOwnUser }

    formGroup: FormGroup<Form.FormGroupControls> | null = null

    onFormGroupReady(formGroup: FormGroup<Form.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
