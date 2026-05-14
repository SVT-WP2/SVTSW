import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicWpProjectAdminUpdateFormComponent } from '../../forms'
import { EpicWpProjectAdminUpdateDialog, EpicWpProjectAdminUpdateForm } from '../../models'

import From = EpicWpProjectAdminUpdateForm
import Dialog = EpicWpProjectAdminUpdateDialog


@Component({
    selector: 'epic-wp-project-admin-update-dialog',
    templateUrl: './epic-wp-project-admin-update-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicWpProjectAdminUpdateFormComponent,
    ],
})
export class EpicWpProjectAdminUpdateDialogComponent extends BaseFormDialogComponent<From.FormData>{

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<EpicWpProjectAdminUpdateForm.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<EpicWpProjectAdminUpdateForm.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
