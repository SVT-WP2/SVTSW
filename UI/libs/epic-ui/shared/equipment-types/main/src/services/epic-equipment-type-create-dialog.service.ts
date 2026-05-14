import { HttpErrorResponse } from '@angular/common/module.d-CnjH8Dlt'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicEquipmentType, EpicEquipmentTypesApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, switchMap, takeUntil, tap } from 'rxjs'

import { EpicEquipmentTypeUpdateDialogComponent } from '../dialogs'
import { EpicEquipmentTypeUpdateDialog, EpicEquipmentTypeUpdateForm } from '../models'

import Dialog = EpicEquipmentTypeUpdateDialog
import Form = EpicEquipmentTypeUpdateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicEquipmentTypeCreateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicEquipmentTypeApiClient = inject(EpicEquipmentTypesApiClient)

    openDialog(options?: { onSuccess?: ((result: EpicEquipmentType) => void) }): void {
        const { onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicEquipmentTypeUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicEquipmentTypeUpdateDialogComponent,
            {},
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => this.epicEquipmentTypeApiClient.create({ name: formData[Form.FormField.name] })),
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
