import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { first, from, map, of, switchMap, takeUntil, tap } from 'rxjs'

import { EpicWaferTypeUpdateDialogComponent } from '../dialogs'
import { EpicWaferTypeUpdateDialog, EpicWaferTypeUpdateForm } from '../models'
import { EpicWaferTypesActions, EpicWaferTypesSelectors } from '../store'

import Dialog = EpicWaferTypeUpdateDialog
import Form = EpicWaferTypeUpdateForm
import DialogSize = MatDialogHelpers.DialogSize
import StoreAction = EpicWaferTypesActions
import StoreSelectors = EpicWaferTypesSelectors


/**
 * Create / clone only. The Kafka contract has no `UpdateWaferType`, so an existing wafer type can seed a new
 * one but is never edited in place.
 */
@Injectable({ providedIn: 'root' })
export class EpicWaferTypeCreateDialogService {

    protected dialogRef: MatDialogRef<EpicWaferTypeUpdateDialogComponent>

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    constructor() {
        this.actions$
            .pipe(ofType(StoreAction.createSuccessAction))
            .subscribe(() => {
                this.dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.doneMessage()
                this.dialogRef.close()
            })

        this.actions$
            .pipe(ofType(StoreAction.createErrorAction))
            .subscribe((error) => {
                this.dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.error(error.error.message)
                this.dialogRef.componentInstance.processingError = error.error.message
            })
    }

    openDialog(cloneFromId?: number): void {
        const waferType$ = cloneFromId
            ? this.store.select(StoreSelectors.selectOneWaferType(cloneFromId))
            : of(undefined)

        waferType$
            .pipe(
                first(),
            )
            .subscribe((waferType) => {
                this.dialogRef = MatDialogHelpers.openDialog<EpicWaferTypeUpdateDialogComponent, Dialog.Data>(
                    this.dialog,
                    EpicWaferTypeUpdateDialogComponent,
                    {
                        formData: waferType ? Form.toFormData(waferType) : undefined,
                        isClone: !!waferType,
                    },
                    {
                        ...MatDialogHelpers.getDefaultConfig(DialogSize.Small),
                    },
                )

                this.dialogRef.componentInstance.submit$
                    .pipe(
                        takeUntil(this.dialogRef.componentInstance.destroyed$),
                        tap(() => this.dialogRef.componentInstance.isProcessing = true),
                        switchMap((formData) => from(Form.formDataToCreateRequest(formData))),
                        map((create) => StoreAction.createRequestAction({ create })),
                    )
                    .subscribe((action) => {
                        this.store.dispatch(action)
                    })
            })
    }

}
