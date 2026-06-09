import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicChip, EpicChipsApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, switchMap, takeUntil, tap, throwError } from 'rxjs'


import { EpicChipCreateDialog, EpicChipCreateDialogComponent } from '../dialogs'
import { EpicChipCreateForm } from '../forms'

import Dialog = EpicChipCreateDialog
import DialogSize = MatDialogHelpers.DialogSize
import Form = EpicChipCreateForm


@Injectable({ providedIn: 'root' })
export class EpicChipCreateDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicChipsApiClient = inject(EpicChipsApiClient)

    openDialog(payload: { asicId: number; onSuccess?: (chip: EpicChip) => void }): void {
        const { asicId, onSuccess } = payload
        const dialogRef = MatDialogHelpers.openDialog<EpicChipCreateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicChipCreateDialogComponent,
            {},
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                tap(() => dialogRef.componentInstance.isProcessing = true),
                takeUntil(dialogRef.componentInstance.destroyed$),
                switchMap((formData) => this.epicChipsApiClient.create({
                    asicId,
                    generalLocation: formData[Form.FormField.generalLocation],
                    serialNumber: formData[Form.FormField.serialNumber],
                })),
                catchError((error: HttpErrorResponse) => {
                    dialogRef.componentInstance.processingError = error.message
                    this.epicNotificationService.error(dialogRef.componentInstance.processingError, 'Processing Error')
                    dialogRef.componentInstance.isProcessing = false
                    return throwError(() => error)
                }),
            )
            .subscribe((entity: EpicChip) => {
                dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.doneMessage()
                if (onSuccess) {
                    onSuccess(entity)
                }
                dialogRef.close()
            })
    }

}
