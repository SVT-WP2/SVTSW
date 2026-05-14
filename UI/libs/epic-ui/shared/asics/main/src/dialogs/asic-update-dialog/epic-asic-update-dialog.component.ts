import { Component, inject } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicAsicUpdateFormComponent } from '../../forms'
import { EpicWaferUpdateDialog, EpicAsicUpdateForm } from '../../models'

import From = EpicAsicUpdateForm
import Dialog = EpicWaferUpdateDialog


@Component({
    selector: 'epic-asic-update-dialog',
    templateUrl: './epic-asic-update-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicAsicUpdateFormComponent,
        EpicIconComponent,
    ],
})
export class EpicAsicUpdateDialogComponent extends BaseFormDialogComponent<From.FormData>{

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly isUpdate = !!this.dialogData.formData && !this.dialogData.isClone

}
