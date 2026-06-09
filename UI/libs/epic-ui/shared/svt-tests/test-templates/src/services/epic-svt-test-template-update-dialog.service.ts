import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicSvtTestTemplate, EpicSvtTestTemplatesApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, switchMap, takeUntil, tap } from 'rxjs'

import { EpicSvtTestTemplateUpdateDialogComponent } from '../dialogs'
import { EpicSvtTestTemplateUpdateDialog, EpicSvtTestTemplateUpdateForm } from '../models'

import Dialog = EpicSvtTestTemplateUpdateDialog
import Form = EpicSvtTestTemplateUpdateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTemplateUpdateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicSvtTestTemplatesApiClient = inject(EpicSvtTestTemplatesApiClient)

    openDialog(entity: EpicSvtTestTemplate, options?: { onSuccess?: ((result: EpicSvtTestTemplate) => void) }): void {
        const { onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicSvtTestTemplateUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicSvtTestTemplateUpdateDialogComponent,
            { formData: Form.toFormData(entity) },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => this.epicSvtTestTemplatesApiClient.update(
                    entity.id,
                    { isEnabled: formData.isEnabled },
                )),
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

