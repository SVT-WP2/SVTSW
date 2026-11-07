import { Component, inject } from '@angular/core'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { EpicMatDialogModule } from 'epic-ui/common/components'

import { EpicWpProbeCardDetailsDialog } from '../../models'

import Dialog = EpicWpProbeCardDetailsDialog


@Component({
    selector: 'epic-wp-probe-card-details-dialog',
    templateUrl: './epic-wp-probe-card-details-dialog.component.html',
    standalone: true,
    imports: [
        MatDialogModule,
        EpicMatDialogModule,
    ],
})
export class EpicWpProbeCardDetailsDialogComponent {

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    readonly rows: { label: string; value: string | number }[] = [
        { label: 'ID', value: this.dialogData.probeCard.id },
        { label: 'Name', value: this.dialogData.probeCard.name },
        { label: 'Serial Number', value: this.dialogData.probeCard.serialNumber },
        { label: 'Model', value: this.dialogData.probeCard.model },
        { label: 'Arrive On', value: this.dialogData.probeCard.arriveDate },
        { label: 'Location', value: this.dialogData.probeCard.location },
        { label: 'Type', value: this.dialogData.probeCard.type },
        { label: 'Vendor', value: this.dialogData.probeCard.vendor },
        { label: 'Cleaning Interval', value: this.dialogData.probeCard.vendorCleaningInterval },
    ]

}
