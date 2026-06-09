import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicAsic, EpicAsicsApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, switchMap, takeUntil, tap, throwError } from 'rxjs'


import { EpicAsicUpdateDialogComponent } from '../dialogs'
import { EpicAsicUpdateForm, EpicWaferUpdateDialog } from '../models'

import Dialog = EpicWaferUpdateDialog
import DialogSize = MatDialogHelpers.DialogSize
import Form = EpicAsicUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicAsicCreateDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicAsicsApiClient = inject(EpicAsicsApiClient)

    openDialog(payload?: { waferId?: number; asic?: EpicAsic; isClone?: boolean; onSuccess?: (asic: EpicAsic) => void }): void {
        const dialogRef = MatDialogHelpers.openDialog<EpicAsicUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicAsicUpdateDialogComponent,
            {
                formData: payload?.asic ? Form.toFormData(payload.asic) : { waferId: payload?.waferId || null },
                isClone: payload?.isClone || false,
            },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                switchMap((formData) => this.epicAsicsApiClient.create(Form.formDataToCreateRequest(formData))),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                catchError((error: HttpErrorResponse) => {
                    dialogRef.componentInstance.processingError = error.message
                    this.epicNotificationService.error(dialogRef.componentInstance.processingError, 'Processing Error')
                    dialogRef.componentInstance.isProcessing = false
                    return throwError(() => error)
                }),
            )
            .subscribe((asic: EpicAsic) => {
                dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.doneMessage()
                if (payload?.onSuccess) {
                    payload.onSuccess(asic)
                }
                dialogRef.close()
            })
    }

}
