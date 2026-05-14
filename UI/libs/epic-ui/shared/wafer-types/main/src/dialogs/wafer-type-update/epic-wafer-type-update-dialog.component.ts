import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicWaferTypeUpdateFormComponent } from '../../forms'
import { EpicWaferTypeUpdateDialog, EpicWaferTypeUpdateForm } from '../../models'

import From = EpicWaferTypeUpdateForm
import Dialog = EpicWaferTypeUpdateDialog


@Component({
    selector: 'epic-wafer-update-dialog',
    templateUrl: './epic-wafer-type-update-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicWaferTypeUpdateFormComponent,
        EpicIconComponent,
    ],
})
export class EpicWaferTypeUpdateDialogComponent extends BaseFormDialogComponent<From.FormData>{

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<EpicWaferTypeUpdateForm.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<EpicWaferTypeUpdateForm.FormGroupControls>): void {
        this.formGroup = formGroup
    }
    
}
