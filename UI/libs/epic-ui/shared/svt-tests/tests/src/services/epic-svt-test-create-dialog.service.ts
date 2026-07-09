import { HttpErrorResponse } from '@angular/common/http'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicSvtTest, EpicSvtTestsApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, switchMap, takeUntil, tap } from 'rxjs'

import { EpicSvtTestCreateDialog, EpicSvtTestCreateDialogComponent } from '../dialogs'
import { EpicSvtTestCreateForm } from '../forms'

import Dialog = EpicSvtTestCreateDialog
import Form = EpicSvtTestCreateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicSvtTestCreateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicSvtTestsApiClient = inject(EpicSvtTestsApiClient)

    openDialog(options?: { onSuccess?: ((result: EpicSvtTest) => void) }): void {
        const { onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicSvtTestCreateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicSvtTestCreateDialogComponent,
            {},
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => (
                    this.epicSvtTestsApiClient.create(Form.formDataToCreateRequest(formData))
                        .pipe(
                            // caught inside the switchMap so a failed attempt does not kill the submit stream
                            catchError((error: HttpErrorResponse) => {
                                dialogRef.componentInstance.processingError = error.message
                                this.epicNotificationService.error(error.message, 'Processing Error')
                                dialogRef.componentInstance.isProcessing = false
                                return EMPTY
                            }),
                        )
                )),
            )
            .subscribe((result) => {
                if (onSuccess) {
                    onSuccess(result)
                }
                dialogRef.close()
            })
    }

}
