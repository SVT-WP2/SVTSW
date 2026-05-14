import { HttpErrorResponse } from '@angular/common/module.d-CnjH8Dlt'
import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicSvtTestSetupConfig } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, EMPTY, from, switchMap, takeUntil, tap } from 'rxjs'

import { EpicSvtTestSetupConfigCreateDialog, EpicSvtTestSetupConfigCreateDialogComponent } from '../dialogs'
import { EpicSvtTestSetupConfigCreateForm } from '../forms'
import { EpicSvtTestSetupsStoreFacade } from '../store'

import Dialog = EpicSvtTestSetupConfigCreateDialog
import Form = EpicSvtTestSetupConfigCreateForm
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicSvtTestSetupConfigCreateDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly epicNotificationService = inject(EpicNotificationService)
    protected readonly epicSvtTestSetupsStoreFacade = inject(EpicSvtTestSetupsStoreFacade)

    openDialog(options: { testSetupId: number; onSuccess?: ((result: EpicSvtTestSetupConfig) => void) }): void {
        const { testSetupId, onSuccess } = options ?? {}
        const dialogRef = MatDialogHelpers.openDialog<EpicSvtTestSetupConfigCreateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicSvtTestSetupConfigCreateDialogComponent,
            {
                testSetupId,
            },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
                switchMap((formData) => from(Form.formDataToCreateRequest(formData, testSetupId))),
                switchMap((createRequest) => this.epicSvtTestSetupsStoreFacade.createConfig(createRequest)),
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
