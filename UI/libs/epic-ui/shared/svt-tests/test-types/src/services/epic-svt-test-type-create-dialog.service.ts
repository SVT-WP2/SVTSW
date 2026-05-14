import { HttpErrorResponse } from '@angular/common/module.d-CnjH8Dlt'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicSvtTestType } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, from, switchMap, takeUntil, tap } from 'rxjs'

import { EpicSvtTestTypeCreateDialog, EpicSvtTestTypeCreateDialogComponent } from '../dialogs'
import { EpicSvtTestTypeCreateForm } from '../forms'
import { EpicSvtTestTypesStoreFacade } from '../store'

import Dialog = EpicSvtTestTypeCreateDialog
import Form = EpicSvtTestTypeCreateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypeCreateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicSvtTestTypesStoreFacade = inject(EpicSvtTestTypesStoreFacade)

    openDialog(options?: { onSuccess?: ((result: EpicSvtTestType) => void) }): void {
        const { onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicSvtTestTypeCreateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicSvtTestTypeCreateDialogComponent,
            {},
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => from(Form.formDataToCreateRequest(formData))),
                switchMap((createRequest) => this.epicSvtTestTypesStoreFacade.create(createRequest)),
                catchError((error: HttpErrorResponse) => {
                    dialogRef.componentInstance.processingError = error.message
                    this.epicNotificationService.error(error.message, 'Processing Error')
                    dialogRef.componentInstance.isProcessing = false
                    return EMPTY
                }),
            )
            .subscribe((result) => {
                if (onSuccess) {
                    onSuccess(result.testType)
                }
                dialogRef.close()
            })
    }

}

