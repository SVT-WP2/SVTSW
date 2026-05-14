import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicEquipmentUpdateFormComponent } from '../../forms'
import { EpicEquipmentUpdateDialog, EpicEquipmentUpdateForm } from '../../models'

import From = EpicEquipmentUpdateForm
import Dialog = EpicEquipmentUpdateDialog


@Component({
    selector: 'epic-equipment-update-dialog',
    templateUrl: './epic-equipment-update-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicEquipmentUpdateFormComponent,
        EpicIconComponent,
    ],
})
export class EpicEquipmentUpdateDialogComponent extends BaseFormDialogComponent<From.FormData> {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<EpicEquipmentUpdateForm.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<EpicEquipmentUpdateForm.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
