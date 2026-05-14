import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicEquipmentTypeUpdateFormComponent } from '../../forms'
import { EpicEquipmentTypeUpdateDialog, EpicEquipmentTypeUpdateForm } from '../../models'

import From = EpicEquipmentTypeUpdateForm
import Dialog = EpicEquipmentTypeUpdateDialog


@Component({
    selector: 'epic-equipment-type-update-dialog',
    templateUrl: './epic-equipment-type-update-dialog.component.html',
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicEquipmentTypeUpdateFormComponent,
        EpicIconComponent,
    ],
})
export class EpicEquipmentTypeUpdateDialogComponent extends BaseFormDialogComponent<From.FormData> {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<EpicEquipmentTypeUpdateForm.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<EpicEquipmentTypeUpdateForm.FormGroupControls>): void {
        this.formGroup = formGroup
    }

}
