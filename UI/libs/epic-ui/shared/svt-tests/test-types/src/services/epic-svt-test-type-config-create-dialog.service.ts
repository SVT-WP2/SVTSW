import { HttpErrorResponse } from '@angular/common/module.d-CnjH8Dlt'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicSvtTestTypeConfig } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, from, switchMap, takeUntil, tap } from 'rxjs'

import { EpicSvtTestTypeConfigCreateDialog, EpicSvtTestTypeConfigCreateDialogComponent } from '../dialogs'
import { EpicSvtTestTypeConfigCreateForm } from '../forms'
import { EpicSvtTestTypesStoreFacade } from '../store'

import Dialog = EpicSvtTestTypeConfigCreateDialog
import Form = EpicSvtTestTypeConfigCreateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicSvtTestTypeConfigCreateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicSvtTestTypesStoreFacade = inject(EpicSvtTestTypesStoreFacade)

    openDialog(options: { testTypeId: number; onSuccess?: ((result: EpicSvtTestTypeConfig) => void) }): void {
        const { testTypeId, onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicSvtTestTypeConfigCreateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicSvtTestTypeConfigCreateDialogComponent,
            {
                testTypeId,
            },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => from(Form.formDataToCreateRequest(formData, testTypeId))),
                switchMap((createRequest) => this.epicSvtTestTypesStoreFacade.createConfig(createRequest)),
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

