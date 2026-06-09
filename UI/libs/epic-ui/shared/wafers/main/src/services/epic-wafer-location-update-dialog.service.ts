import { inject, Injectable } from '@angular/core'
import { MatDialog } from '@angular/material/dialog'
import { EpicNotificationService } from 'epic-ui/common/components'
import { EpicLocationUpdateDialog, EpicLocationUpdateDialogComponent } from 'epic-ui/shared/location'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import moment from 'moment'
import { takeUntil, tap } from 'rxjs'

import { EpicWafersStoreFacade } from '../store'

import Dialog = EpicLocationUpdateDialog
import DialogSize = MatDialogHelpers.DialogSize


@Injectable({ providedIn: 'root' })
export class EpicWaferLocationUpdateDialogService {

    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(EpicWafersStoreFacade)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    openDialog(waferId: number): void {
        const wafer = this.store.selectOneWafer(waferId)!
        // const wafer = undefined
        const dialogRef = MatDialogHelpers.openDialog<EpicLocationUpdateDialogComponent, Dialog.Data>(
            this.dialog,
            EpicLocationUpdateDialogComponent,
            {
                dialogTitle: 'Update Wafer Location',
                formOptions: {
                    excludeGeneralLocation: wafer.generalLocation ? [wafer.generalLocation] : undefined,
                },
                submitBtnText: 'Update',
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
                this.store.actionUpdateLocation(
                    wafer.id,
                    {
                        note: formData.note!,
                        generalLocation: formData.generalLocation!,
                        date: moment(formData.date).format('YYYY-MM-DD'),
                    },
                )
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
