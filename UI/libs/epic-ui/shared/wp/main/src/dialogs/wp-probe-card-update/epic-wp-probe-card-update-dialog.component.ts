import { Component, inject } from '@angular/core'
import { FormGroup } from '@angular/forms'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicWpProbeCardUpdateFormComponent } from '../../forms'
import { EpicWpProbeCardUpdateDialog, EpicWpProbeCardUpdateForm } from '../../models'

import From = EpicWpProbeCardUpdateForm
import Dialog = EpicWpProbeCardUpdateDialog


@Component({
    selector: 'epic-wp-probe-card-update-dialog',
    templateUrl: './epic-wp-probe-card-update-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicIconComponent,
        EpicWpProbeCardUpdateFormComponent,
    ],
})
export class EpicWpProbeCardUpdateDialogComponent extends BaseFormDialogComponent<From.FormData>{

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

    formGroup: FormGroup<From.FormGroupControls>

    onFormGroupReady(formGroup: FormGroup<From.FormGroupControls>): void {
        this.formGroup = formGroup
    }
    
}
