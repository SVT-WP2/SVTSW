import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { first, from, map, merge, of, switchMap, takeUntil, tap } from 'rxjs'

import { EpicWaferTypeUpdateDialogComponent } from '../dialogs'
import { EpicWaferTypeUpdateDialog, EpicWaferTypeUpdateForm } from '../models'
import { EpicWaferTypesActions, EpicWaferTypesSelectors } from '../store'

import Dialog = EpicWaferTypeUpdateDialog
import Form = EpicWaferTypeUpdateForm
import DialogSize = MatDialogHelpers.DialogSize
import StoreAction = EpicWaferTypesActions
import StoreSelectors = EpicWaferTypesSelectors


@Injectable({ providedIn: 'root' })
export class EpicWaferTypeCreateDialogService {

    protected dialogRef: MatDialogRef<EpicWaferTypeUpdateDialogComponent>

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    constructor() {
        merge(
            this.actions$.pipe(ofType(StoreAction.createSuccessAction)),
            this.actions$.pipe(ofType(StoreAction.updateSuccessAction)),
        )
            .subscribe(() => {
                this.dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.doneMessage()
                this.dialogRef.close()
            })

        merge(
            this.actions$.pipe(ofType(StoreAction.createErrorAction)),
            this.actions$.pipe(ofType(StoreAction.updateErrorAction)),
        )
            .subscribe((error) => {
                this.dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.error(error.error.message)
                this.dialogRef.componentInstance.processingError = error.error.message
            })
    }

    openDialog(entityId?: number, options?: { isClone?: boolean }): void {
        const wafer$ = entityId
            ? this.store.select(StoreSelectors.selectOneWaferType(entityId))
            : of(undefined)

        wafer$
            .pipe(
                first(),
            )
            .subscribe((wafer) => {
                this.dialogRef = MatDialogHelpers.openDialog<EpicWaferTypeUpdateDialogComponent, Dialog.Data>(
                    this.dialog,
                    EpicWaferTypeUpdateDialogComponent,
                    {
                        formData: wafer ? Form.toFormData(wafer) : undefined,
                        isClone: options?.isClone || false,
                    },
                    {
                        ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
                    },
                )

                this.dialogRef.componentInstance.submit$
                    .pipe(
                        takeUntil(this.dialogRef.componentInstance.destroyed$),
                        tap(() => this.dialogRef.componentInstance.isProcessing = true),
                        switchMap((formData) => {
                            if (wafer && !options?.isClone) {
                                // update
                                return from(Form.formDataToUpdateRequest(formData))
                                    .pipe(
                                        map(update => StoreAction.updateRequestAction({
                                            id: wafer.id,
                                            update,
                                        })),
                                    )
                            }
                            else {
                                // create
                                return from(Form.formDataToCreateRequest(formData))
                                    .pipe(
                                        map(create => StoreAction.createRequestAction({ create })),
                                    )
                            }
                        }),
                    )
                    .subscribe((action) => {
                        this.store.dispatch(action)
                    })
            })
    }

}
