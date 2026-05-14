import { HttpErrorResponse } from '@angular/common/module.d-CnjH8Dlt'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicEquipment, EpicEquipmentApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, from, switchMap, takeUntil, tap } from 'rxjs'

import { EpicEquipmentUpdateDialogComponent } from '../dialogs'
import { EpicEquipmentUpdateDialog, EpicEquipmentUpdateForm } from '../models'

import Dialog = EpicEquipmentUpdateDialog
import Form = EpicEquipmentUpdateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicEquipmentCreateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicEquipmentApiClient = inject(EpicEquipmentApiClient)

    openDialog(options?: { onSuccess?: ((result: EpicEquipment) => void) }): void {
        const { onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicEquipmentUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicEquipmentUpdateDialogComponent,
            {},
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => from(Form.formDataToEpicEquipmentCreate(formData))),
                switchMap((createRequest) => this.epicEquipmentApiClient.create(createRequest)),
                catchError((error: HttpErrorResponse) => {
                    dialogRef.componentInstance.processingError = error.message
                    this.epicNotificationService.error(error.message, 'Processing Error')
                    dialogRef.componentInstance.isProcessing = false
                    return EMPTY
                }),
            )
            .subscribe((result) => {
                if (onSuccess) {
                    onSuccess(result)
                }
                dialogRef.close()
            })
    }

}
