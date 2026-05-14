import { HttpErrorResponse } from '@angular/common/module.d-CnjH8Dlt'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicSvtTestSetup } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, from, switchMap, takeUntil, tap } from 'rxjs'

import { EpicSvtTestSetupCreateDialog, EpicSvtTestSetupCreateDialogComponent } from '../dialogs'
import { EpicSvtTestSetupCreateForm } from '../forms'
import { EpicSvtTestSetupsStoreFacade } from '../store'

import Dialog = EpicSvtTestSetupCreateDialog
import Form = EpicSvtTestSetupCreateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupCreateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicSvtTestSetupsStoreFacade = inject(EpicSvtTestSetupsStoreFacade)

    openDialog(options?: { onSuccess?: ((result: EpicSvtTestSetup) => void) }): void {
        const { onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicSvtTestSetupCreateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicSvtTestSetupCreateDialogComponent,
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
                switchMap((createRequest) => this.epicSvtTestSetupsStoreFacade.create(createRequest)),
                catchError((error: HttpErrorResponse) => {
                    dialogRef.componentInstance.processingError = error.message
                    this.epicNotificationService.error(error.message, 'Processing Error')
                    dialogRef.componentInstance.isProcessing = false
                    return EMPTY
                }),
            )
            .subscribe((result) => {
                if (onSuccess) {
                    onSuccess(result.testSetup)
                }
                dialogRef.close()
            })
    }

}
