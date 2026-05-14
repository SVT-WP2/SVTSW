import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { isObservable, Observable } from 'rxjs'
import { take, takeUntil } from 'rxjs/operators'

import { EpicConfirmDialog, EpicConfirmDialogComponent } from '../components'


export namespace EpicConfirmDialogControl {

    export function showConfirmDialog(
        dialog: MatDialog,
        data: EpicConfirmDialog.Data,
        onSuccess: (dialogRef: MatDialogRef<EpicConfirmDialogComponent>) => void | Observable<void>,
        onDecline?: () => void,
        config?: Omit<MatDialogConfig, 'data'>,
    ): MatDialogRef<EpicConfirmDialogComponent> {

        const dialogRef = dialog.open<EpicConfirmDialogComponent, EpicConfirmDialog.Data>(
            EpicConfirmDialogComponent,
            {
                ...MatDialogHelpers.getDefaultConfig(MatDialogHelpers.DialogSize.Small),
                ...config,
                data,
            },
        )

        // on confirm button clicked
        dialogRef.componentInstance.confirm$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
            )
            .subscribe(() => {
                dialogRef.componentInstance.isProcessing = true
                const result = onSuccess(dialogRef)
                if (isObservable(result)) {
                    result
                        .pipe(
                            take(1),
                        )
                        .subscribe(
                            () => {
                                dialogRef.componentInstance.isProcessing = false
                                dialogRef.close()
                            },
                            () => dialogRef.componentInstance.isProcessing = false,
                        )
                }
                else {
                    dialogRef.componentInstance.isProcessing = false
                    dialogRef.close()
                }

            })

        // on decline button clicked
        dialogRef.componentInstance.decline$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
            )
            .subscribe(() => {
                if (onDecline) {
                    onDecline()
                }
                dialogRef.close()
            })

        return dialogRef
    }

    export function showDeleteConfirmDialog(
        dialog: MatDialog,
        onSuccess: (dialogRef: MatDialogRef<EpicConfirmDialogComponent>) => void | Observable<any>,
        onDecline?: () => void,
    ): MatDialogRef<EpicConfirmDialogComponent> {

        const dialogData: EpicConfirmDialog.Data = {
            headerTitle: 'COMMON.CONFIRM_DIALOG__DELETE__TITLE',
            confirmButtonText: 'COMMON.DELETE',
            confirmButtonColor: 'warn',
            message: 'COMMON.CONFIRM_DIALOG__DELETE__MESSAGE',
        }

        return showConfirmDialog(
            dialog,
            dialogData,
            onSuccess,
            onDecline,
        )
    }

}
