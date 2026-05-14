import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { Actions, ofType } from '@ngrx/effects'
import { Store } from '@ngrx/store'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { first, from, map, merge, of, switchMap, takeUntil, tap, throwError } from 'rxjs'

import { EpicWpProjectAdminUpdateDialogComponent } from '../../dialogs'
import { EpicWpProjectAdminUpdateDialog, EpicWpProjectAdminUpdateForm } from '../../models'
import { EpicWpProjectsActions, EpicWpProjectsSelectors } from '../../store'

import Dialog = EpicWpProjectAdminUpdateDialog
import Form = EpicWpProjectAdminUpdateForm
import DialogSize = MatDialogHelpers.DialogSize
import StoreAction = EpicWpProjectsActions
import StoreSelectors = EpicWpProjectsSelectors


@Injectable({ providedIn: 'root' })
export class EpicWpProjectAdminUpdateDialogService {

    protected dialogRef: MatDialogRef<EpicWpProjectAdminUpdateDialogComponent>

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly store = inject(Store)
    protected readonly actions$ = inject(Actions)
    protected readonly epicNotificationService = inject(EpicNotificationService)

    constructor() {
        merge(
            this.actions$.pipe(ofType(StoreAction.createSuccessAction)),
        )
            .subscribe(() => {
                this.dialogRef.componentInstance.isProcessing = false
                this.epicNotificationService.doneMessage()
                this.dialogRef.close()
            })

        merge(
            this.actions$.pipe(ofType(StoreAction.createErrorAction)),
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
            .subscribe((entity) => {
                this.dialogRef = MatDialogHelpers.openDialog<EpicWpProjectAdminUpdateDialogComponent, Dialog.Data>(
                    this.dialog,
                    EpicWpProjectAdminUpdateDialogComponent,
                    {
                        formData: entity ? Form.toFormData(entity) : undefined,
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
                            if (entity && !options?.isClone) {
                                // update
                                return throwError(() => new Error('Not Implemented'))
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
