import { Component, inject } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicIconComponent, EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseFormDialogComponent } from 'epic-ui/utils'

import { EpicChipCreateForm, EpicChipCreateFormComponent } from '../../forms'

import { EpicChipCreateDialog } from './epic-chip-create-dialog.models'

import From = EpicChipCreateForm
import Dialog = EpicChipCreateDialog


@Component({
    selector: 'epic-chip-create-dialog',
    templateUrl: './epic-chip-create-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        MatButton,
        TranslatePipe,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicChipCreateFormComponent,
        EpicIconComponent,
    ],
})
export class EpicChipCreateDialogComponent extends BaseFormDialogComponent<From.FormData> {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

}
