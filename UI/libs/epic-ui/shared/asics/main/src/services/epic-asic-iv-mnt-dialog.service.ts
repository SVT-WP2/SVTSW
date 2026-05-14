import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicIvMnt } from 'epic-ui/api'
import { EpicIvMntNewForm } from 'epic-ui/shared/iv-mnt'
import { MatDialogHelpers } from 'epic-ui/utils/material'

import { EpicAsicIvMntDialogComponent } from '../dialogs'
import { EpicAsicIvMntDialog } from '../models'
import { EpicAsicsStoreFacade } from '../store'

import Dialog = EpicAsicIvMntDialog
import Form = EpicIvMntNewForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicAsicIvMntDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(EpicAsicsStoreFacade)

    openDialog(payload?: {asicId?: number; formOptions?: Form.FormOptions; isClone?: boolean; asicIvMnt?: EpicIvMnt }): void {
        const dialogRef = MatDialogHelpers.openDialog<EpicAsicIvMntDialogComponent, Dialog.Data>(
            this.dialog,
            EpicAsicIvMntDialogComponent,
            {
                isClone: payload?.isClone || false,
                ivMnt: payload?.asicIvMnt,
            },
            {
                ...MatDialogHelpers.getFullHeightConfig(DialogSize.FullScreen),
                maxHeight: '1200px',
                maxWidth: '2400px',
            },

        )
    }

}
