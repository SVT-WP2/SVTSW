import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { takeUntil, tap } from 'rxjs'

import { EpicWaferUpdateDialogComponent } from '../dialogs'
import { EpicWaferUpdateDialog, EpicWaferUpdateForm } from '../models'
import { EpicWafersStoreFacade } from '../store'

import Dialog = EpicWaferUpdateDialog
import DialogSize = MatDialogHelpers.DialogSize
import Form = EpicWaferUpdateForm


@Injectable({ providedIn: 'root' })
export class EpicWaferCreateDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(EpicWafersStoreFacade)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    openDialog(waferId?: number, options?: { isClone?: boolean }): void {
        const wafer = waferId ? this.store.selectOneWafer(waferId) : undefined
        // const wafer = undefined
        const dialogRef = MatDialogHelpers.openDialog<EpicWaferUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicWaferUpdateDialogComponent,
            {
                formData: wafer ? Form.toFormData(wafer) : undefined,
                isClone: options?.isClone || false,
            },
            {
                ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
            },
        )

        dialogRef.componentInstance.submit$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                tap(() => dialogRef.componentInstance.isProcessing = true),
            )
            .subscribe((formData) => {
                if (wafer && !options?.isClone) {
                    this.store.actionUpdate(wafer.id, Form.formDataToUpdateRequest(formData))
                }
                else {
                    this.store.actionCreate(
                        Form.formDataToCreateRequest(formData),
                    )
                }
            })

        // submit success processing
        this.store.updateProcessingEvents.success$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
            )
            .subscribe(() => {
                dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.doneMessage()
                dialogRef.close()
            })

        // submit error processing
        this.store.updateProcessingEvents.error$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
            )
            .subscribe((state) => {
                dialogRef.componentInstance.processingError = state.updateProcessing.processingError!.message
                this.epicNotificationService.error(dialogRef.componentInstance.processingError, 'Processing Error')
                dialogRef.componentInstance.isProcessing = false
            })
    }

}
