import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { MatDialogHelpers } from 'epic-ui/utils/material'

import { EpicLocationHistoryDialogComponent } from './epic-location-history-dialog.component'
import { EpicLocationHistoryDialog } from './epic-location-history-dialog.models'

import Dialog = EpicLocationHistoryDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicLocationHistoryDialogService {

    protected readonly dialog = inject(MatDialog)

    openDialog(dialogData: Dialog.Data): MatDialogRef<EpicLocationHistoryDialogComponent, void> {
        return MatDialogHelpers.openDialog<EpicLocationHistoryDialogComponent, Dialog.Data, void>(
            this.dialog,
            EpicLocationHistoryDialogComponent,
            dialogData,
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Large),
            },
        )
    }

}
