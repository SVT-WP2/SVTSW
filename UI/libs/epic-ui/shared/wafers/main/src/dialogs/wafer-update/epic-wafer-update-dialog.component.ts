import { Component, inject } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicWaferUpdateFormComponent } from '../../forms'
import { EpicWaferUpdateDialog, EpicWaferUpdateForm } from '../../models'

import From = EpicWaferUpdateForm
import Dialog = EpicWaferUpdateDialog


@Component({
    selector: 'epic-wafer-update-dialog',
    templateUrl: './epic-wafer-update-dialog.component.html',
    imports: [
        TranslatePipe,
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicWaferUpdateFormComponent,
        EpicIconComponent,
    ],
})
export class EpicWaferUpdateDialogComponent extends BaseFormDialogComponent<From.FormData>{

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

}
