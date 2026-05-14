import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog'
import { ProcessingStore } from 'epic-ui/utils'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { isObservable, of, throwError } from 'rxjs'
import { catchError, delay, switchMap, take, takeUntil, tap } from 'rxjs/operators'

import { EpicSelectionListDialogComponent } from '../dialogs'
import { EpicSelectionListDialog } from '../models'

import DialogSize = MatDialogHelpers.DialogSize
import Dialog = EpicSelectionListDialog


@Injectable({ providedIn: 'root' })
export class EpicSelectionListDialogService {

    protected readonly matDialog = inject(MatDialog)

    openDialog<TRecord = unknown, TValue = TRecord>(
        dialogData: Dialog.DialogData<TRecord, TValue>,
        options?: {
            matDialogConfig?: Partial<MatDialogConfig>
            onSubmit?: Dialog.SubmitProcessingFn<TValue, MatDialogRef<EpicSelectionListDialogComponent<TRecord, TValue>>>
        },
    ): MatDialogRef<EpicSelectionListDialogComponent<TRecord, TValue>> {
        const dialogRef = MatDialogHelpers.openDialog<EpicSelectionListDialogComponent<TRecord, TValue>>(
            this.matDialog,
            EpicSelectionListDialogComponent<TRecord, TValue>,
            dialogData,
            {
                ...MatDialogHelpers.getFullHeightConfig(DialogSize.Small),
                ...(options?.matDialogConfig ?? {}),
            },
        )

        // INIT SELECT OPTIONS
        const selectOptions$ = isObservable(dialogData.selectOptions)
            ? dialogData.selectOptions
            : of(dialogData.selectOptions)

        const initProcessingFiledName: keyof EpicSelectionListDialogComponent = 'initProcessing'
        const submitProcessingFiledName: keyof EpicSelectionListDialogComponent = 'submitProcessing'
        const selectOptionsFiledName: keyof EpicSelectionListDialogComponent = 'selectOptions'

        selectOptions$
            .pipe(
                takeUntil(dialogRef.componentInstance.destroyed$),
                catchError((error) => {
                    dialogRef.componentRef!.setInput(
                        initProcessingFiledName,
                        ProcessingStore.eventProcessingFinish(dialogRef.componentInstance.initProcessing, error),
                    )
                    return throwError(() => error)
                }),
                tap(() => (
                    dialogRef.componentRef!.setInput(
                        initProcessingFiledName,
                        ProcessingStore.eventProcessingFinish(dialogRef.componentInstance.initProcessing),
                    )
                )),
            )
            .subscribe((selectOptions) => {
                dialogRef.componentRef!.setInput(
                    selectOptionsFiledName,
                    selectOptions,
                )
            })

        // PROCESS SUBMIT
        if (options?.onSubmit) {
            dialogRef.componentInstance.submit$
                .pipe(
                    takeUntil(dialogRef.componentInstance.destroyed$),
                    tap(() => (
                        dialogRef.componentRef!.setInput(
                            submitProcessingFiledName,
                            ProcessingStore.eventProcessingStart(dialogRef.componentInstance.submitProcessing),
                        )
                    )),
                    delay(0),
                    switchMap((payload) => {
                        const result = options.onSubmit!({ ...payload, dialogRef })
                        return isObservable(result)
                            ? result
                                .pipe(
                                    take(1),
                                    catchError((error) => {
                                        dialogRef.componentRef!.setInput(
                                            submitProcessingFiledName,
                                            ProcessingStore.eventProcessingFinish(dialogRef.componentInstance.submitProcessing, error),
                                        )
                                        return throwError(() => error)
                                    }),
                                )
                            : of(result)

                    }),
                )
                .subscribe(() => {
                    dialogRef.componentRef!.setInput(
                        submitProcessingFiledName,
                        ProcessingStore.eventProcessingFinish(dialogRef.componentInstance.submitProcessing),
                    )
                    dialogRef.close()
                })
        }

        return dialogRef
    }

}
