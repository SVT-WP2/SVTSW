import { Component, inject, Input, OnInit } from '@angular/core'
import { MatButton } from '@angular/material/button'
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog'
import { TranslatePipe } from '@ngx-translate/core'
import { EpicLoaderComponent, EpicContentErrorModule, EpicMatDialogModule } from 'epic-ui/common/components'
import { BaseComponent, ProcessingStore } from 'epic-ui/utils'

import { EpicLocationHistoryGrid, EpicLocationHistoryGridComponent } from '../../components'

import { EpicLocationHistoryDialog } from './epic-location-history-dialog.models'

import Dialog = EpicLocationHistoryDialog


@Component({
    selector: 'epic-location-history-dialog',
    templateUrl: './epic-location-history-dialog.component.html',
    imports: [
        TranslatePipe,
        MatDialogModule,
        MatButton,
        EpicMatDialogModule,
        EpicContentErrorModule,
        EpicLocationHistoryGridComponent,
        EpicLoaderComponent,
    ],
})
export class EpicLocationHistoryDialogComponent extends BaseComponent implements OnInit {

    @Input() initProcessing: ProcessingStore.EventProcessingState = ProcessingStore.getDefaultProcessingState(true)
    @Input() historyRecords: EpicLocationHistoryGrid.RowEntity[]

    readonly dialogData = inject<Dialog.Data>(MAT_DIALOG_DATA)

    ngOnInit(): void {
        if (this.dialogData.historyRecords) {
            this.historyRecords = this.dialogData.historyRecords
            this.initProcessing = ProcessingStore.getDefaultProcessingState()
        }
    }

}
