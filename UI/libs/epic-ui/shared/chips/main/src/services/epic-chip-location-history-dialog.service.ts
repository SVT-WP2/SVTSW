import { inject, Injectable } from '@angular/core'
import { MatDialogRef } from '@angular/material/dialog'
import { EpicChipsApiClient } from 'epic-ui/api'
import { EpicLocationHistoryDialogComponent, EpicLocationHistoryDialogService } from 'epic-ui/shared/location'
import { ProcessingStore } from 'epic-ui/utils'
import { catchError, takeUntil, throwError } from 'rxjs'


@Injectable({ providedIn: 'root' })
export class EpicChipLocationHistoryDialogService {

    // DI
    protected readonly epicLocationHistoryDialogService = inject(EpicLocationHistoryDialogService)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)

    openDialog(chipId: number): MatDialogRef<EpicLocationHistoryDialogComponent, void> {
        const dialogRef = this.epicLocationHistoryDialogService.openDialog({
            dialogTitle: 'Chip Location History',
        })

        this.epicChipsApiClient.fetchChipLocationHistory(chipId)
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                catchError(err => {
                    dialogRef.componentRef?.setInput(
                        'initProcessing' satisfies keyof EpicLocationHistoryDialogComponent,
                        ProcessingStore.eventProcessingFinish(
                            ProcessingStore.getDefaultProcessingState(),
                            err,
                        ),
                    )

                    return throwError(() => err)
                }),
            )
            .subscribe(historyRecords => {
                const historyRecordEntities = historyRecords
                    .map(item => ({
                        ...item,
                        id: window.crypto.randomUUID(),
                    }))
                dialogRef.componentRef?.setInput(
                    'historyRecords' satisfies keyof EpicLocationHistoryDialogComponent,
                    historyRecordEntities,
                )
                dialogRef.componentRef?.setInput(
                    'initProcessing' satisfies keyof EpicLocationHistoryDialogComponent,
                    ProcessingStore.getDefaultProcessingState(),
                )
            })

        return dialogRef
    }

}
