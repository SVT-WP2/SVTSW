import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicWaferType } from 'epic-ui/api'
import { MatDialogHelpers } from 'epic-ui/utils/material'

import { EpicWaferTypeDetailsDialogComponent } from '../dialogs'
import { EpicWaferTypeDetailsDialog } from '../models'

import Dialog = EpicWaferTypeDetailsDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicWaferTypeDetailsDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)

    constructor() {
    }

    openDialog(waferType: EpicWaferType): void {
        const dialogRef = MatDialogHelpers.openDialog<EpicWaferTypeDetailsDialogComponent, Dialog.Data>(
            this.dialog,
            EpicWaferTypeDetailsDialogComponent,
            {
                waferType,
            },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Large),
                height: '90vh',
                maxHeight: '1000px',
            },
        )
    }

}
