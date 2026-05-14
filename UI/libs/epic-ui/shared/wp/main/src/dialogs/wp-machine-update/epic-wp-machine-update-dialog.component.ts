import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicWpMachineUpdateFormComponent } from '../../forms'
import { EpicWpMachineUpdateDialog, EpicWpMachineUpdateForm } from '../../models'

import From = EpicWpMachineUpdateForm
import Dialog = EpicWpMachineUpdateDialog


@Component({
    selector: 'epic-wp-machine-update-dialog',
    templateUrl: './epic-wp-machine-update-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicWpMachineUpdateFormComponent,
    ],
})
export class EpicWpMachineUpdateDialogComponent extends BaseFormDialogComponent<From.FormData>{

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<EpicWpMachineUpdateForm.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<EpicWpMachineUpdateForm.FormGroupControls>): void {
        this.formGroup = formGroup
    }
    
}
