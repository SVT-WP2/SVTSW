import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { EpicWpProbeCard } from 'svt-ts-types'

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
