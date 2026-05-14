import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { MatDialogHelpers } from 'epic-ui/utils/material'


import { EpicChipCreateManyPreviewDialog, EpicChipCreateManyPreviewDialogComponent } from '../dialogs'

import Dialog = EpicChipCreateManyPreviewDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicChipCreateManyPreviewDialogService {

    protected readonly dialog = inject(MatDialog)

    openDialog(dialogData: EpicChipCreateManyPreviewDialog.Data): void {
        MatDialogHelpers.openDialog<EpicChipCreateManyPreviewDialogComponent, Dialog.Data>(
            this.dialog,
            EpicChipCreateManyPreviewDialogComponent,
            dialogData,
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Medium),
            },
        )
    }

}
