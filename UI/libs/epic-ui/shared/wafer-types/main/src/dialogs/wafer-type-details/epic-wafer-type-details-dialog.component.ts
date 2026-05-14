import { Component, inject } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { EpicAlertModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { EpicWaferTypeDetailsDialog, EpicWaferTypeInfoComponent } from 'epic-ui/shared/wafer-types'

import Dialog = EpicWaferTypeDetailsDialog


@Component({
    selector: 'epic-wafer-type-details-dialog',
    templateUrl: './epic-wafer-type-details-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        EpicMatDialogModule,
        EpicAlertModule,
        EpicWaferTypeInfoComponent,
    ],
})
export class EpicWaferTypeDetailsDialogComponent {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)


}
