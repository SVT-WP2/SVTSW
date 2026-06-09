import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { first, merge, of, takeUntil, tap } from 'rxjs'

import { EpicWpProbeCardUpdateDialogComponent } from '../../dialogs'
import { EpicWpProbeCardUpdateDialog, EpicWpProbeCardUpdateForm } from '../../models'
import { EpicWpProbeCardsActions, EpicWpProbeCardsSelectors } from '../../store'

import Dialog = EpicWpProbeCardUpdateDialog
import Form = EpicWpProbeCardUpdateForm
import DialogSize = MatDialogHelpers.DialogSize
import StoreAction = EpicWpProbeCardsActions
import StoreSelectors = EpicWpProbeCardsSelectors


@Injectable({ providedIn: 'root' })
export class EpicWpProbeCardUpdateDialogService {

    protected dialogRef: MatDialogRef<EpicWpProbeCardUpdateDialogComponent>

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
            ? this.store.select(StoreSelectors.selectOneEntityById(entityId))
            : of(undefined)

        wafer$
            .pipe(
                first(),
            )
            .subscribe((wafer) => {
                this.dialogRef = MatDialogHelpers.openDialog<EpicWpProbeCardUpdateDialogComponent, Dialog.Data>(
                    this.dialog,
                    EpicWpProbeCardUpdateDialogComponent,
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
                    )
                    .subscribe((formData) => {
                        if (wafer && !options?.isClone) {
                            // update
                            this.store.dispatch(
                                StoreAction.updateRequestAction({
                                    id: wafer.id,
                                    update: Form.formDataToUpdateRequest(formData),
                                }),
                            )
                        }
                        else {
                            // create
                            const create = Form.formDataToCreateRequest(formData)
                            this.store.dispatch(
                                StoreAction.createRequestAction({ create }),
                            )
                        }
                    })
            })
    }

}
