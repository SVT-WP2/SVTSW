import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicEquipment, EpicEquipmentApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { EpicLocationUpdateDialog, EpicLocationUpdateDialogComponent } from 'epic-ui/shared/location'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import moment from 'moment'
import { catchError, switchMap, takeUntil, tap, throwError } from 'rxjs'

import Dialog = EpicLocationUpdateDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicEquipmentLocationUpdateDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly epicEquipmentApiClient = inject(EpicEquipmentApiClient)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    openDialog(equipmentId: number, { onSuccess }: { onSuccess?: (equipment: EpicEquipment) => void } = {}): void {
        // const wafer = undefined
        const dialogRef = MatDialogHelpers.openDialog<EpicLocationUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicLocationUpdateDialogComponent,
            {
                dialogTitle: 'Update Equipment Location',
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
                switchMap((formData) => this.epicEquipmentApiClient.updateEquipmentLocation(
                    equipmentId,
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
            .subscribe((equipment) => {
                if (onSuccess) {
                    onSuccess(equipment)
                }
                dialogRef.close()
            })
    }

}
