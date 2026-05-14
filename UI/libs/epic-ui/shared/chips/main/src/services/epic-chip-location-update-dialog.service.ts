import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicChip, EpicChipsApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { EpicLocationUpdateDialog, EpicLocationUpdateDialogComponent } from 'epic-ui/shared/location'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import moment from 'moment'
import { catchError, switchMap, takeUntil, tap, throwError } from 'rxjs'


import Dialog = EpicLocationUpdateDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicChipLocationUpdateDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    openDialog(chipId: number, { onSuccess }: { onSuccess?: (chip: EpicChip) => void } = {}): void {
        // const wafer = undefined
        const dialogRef = MatDialogHelpers.openDialog<EpicLocationUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicLocationUpdateDialogComponent,
            {
                dialogTitle: 'Update Chip Location',
                submitBtnText: 'Update',
            },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => this.epicChipsApiClient.updateChipLocation(
                    chipId,
                    {
                        note: formData.note!,
                        generalLocation: formData.generalLocation!,
                        date: moment(formData.date).format('YYYY-MM-DD'),
                    },
                )),
                catchError((error: HttpErrorResponse) => {
                    dialogRef.componentInstance.isProcessing = false
                    dialogRef.componentInstance.processingError = error.message
                    this.epicNotificationService.error(error.message, 'Processing Error')
                    return throwError(() => error)
                }),
            )
            .subscribe((chip) => {
                if (onSuccess) {
                    onSuccess(chip)
                }
                dialogRef.close()
            })
    }

}
