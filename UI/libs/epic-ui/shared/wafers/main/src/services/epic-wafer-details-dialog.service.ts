import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { MatDialogHelpers } from 'epic-ui/utils/material'


import { EpicWaferDetailsDialogComponent } from '../dialogs'
import { EpicWaferDetailsDialog } from '../models'
import { EpicWafersStoreFacade } from '../store'

import Dialog = EpicWaferDetailsDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable()
export class EpicWaferDetailsDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(EpicWafersStoreFacade)

    openDialog(waferId?: number): void {
        const dialogRef = MatDialogHelpers.openDialog<EpicWaferDetailsDialogComponent, Dialog.Data>(
            this.dialog,
            EpicWaferDetailsDialogComponent,
            {
                wafer: {
                    id: 1,
                    serialNumber: 'Serial No. 1',
                    batchNumber: 4,
                    thinningDate: '2025-01-25',
                    dicingDate: '2025-01-25',
                    productionDate: '2025-01-25',
                    waferTypeId: 1,
                    generalLocation: 'CERN',
                },
            },
            {
                ...MatDialogHelpers.getFullHeightConfig(DialogSize.FullScreen),
                maxHeight: '1200px',
                maxWidth: '2400px',
            },
        )
    }

}
