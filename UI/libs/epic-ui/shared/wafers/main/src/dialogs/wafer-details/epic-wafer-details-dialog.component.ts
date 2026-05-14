import { Component, inject } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'

import { EpicWaferInfoComponent } from '../../components'
import { EpicWaferDetailsDialog } from '../../models'

import Dialog = EpicWaferDetailsDialog


@Component({
    selector: 'epic-wafer-details-dialog',
    templateUrl: './epic-wafer-details-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicWaferInfoComponent,
    ],
})
export class EpicWaferDetailsDialogComponent {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    imageBase64 = ''


}
