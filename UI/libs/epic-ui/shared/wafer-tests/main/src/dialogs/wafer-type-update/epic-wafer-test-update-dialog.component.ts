import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicIconMatOutlinedPipe, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicWaferTestUpdateFormComponent } from '../../forms'
import { EpicWaferTestUpdateDialog, EpicWaferTestUpdateForm } from '../../models'

import Form = EpicWaferTestUpdateForm
import Dialog = EpicWaferTestUpdateDialog


@Component({
    selector: 'epic-wafer-test-update-dialog',
    templateUrl: './epic-wafer-test-update-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicWaferTestUpdateFormComponent,
        EpicIconComponent,
        TranslatePipe,
        MatButton,
        EpicIconMatOutlinedPipe,
    ],
})
export class EpicWaferTestUpdateDialogComponent extends BaseFormDialogComponent<Form.FormData> {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<Form.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<Form.FormGroupControls>): void {
        this.formGroup = formGroup
    }

    onCreateAndStartBtnClicked(): void {
        throw new Error('Method not implemented.')
    }

}
