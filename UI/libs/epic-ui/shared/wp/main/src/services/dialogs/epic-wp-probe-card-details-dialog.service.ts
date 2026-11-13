import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicWpProbeCard } from 'epic-api-types'
import { MatDialogHelpers } from 'epic-ui/utils/material'

import { EpicWpProbeCardDetailsDialogComponent } from '../../dialogs'
import { EpicWpProbeCardDetailsDialog } from '../../models'

import Dialog = EpicWpProbeCardDetailsDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicWpProbeCardDetailsDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)

    openDialog(probeCard: EpicWpProbeCard): void {
        MatDialogHelpers.openDialog<EpicWpProbeCardDetailsDialogComponent, Dialog.Data>(
            this.dialog,
            EpicWpProbeCardDetailsDialogComponent,
            {
                probeCard,
            },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )
    }

}
