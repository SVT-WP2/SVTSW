import { inject, Injectable } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { EpicAuthApiClient, toEpicApiErrorMessage } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, exhaustMap, map, of, takeUntil } from 'rxjs'

import { EpicAuthPasswordChangeDialogComponent } from '../dialogs'
import { EpicAuthPasswordChangeForm } from '../models'

import Form = EpicAuthPasswordChangeForm


/**
 * Opens the dialog of the own password and sends it. A refusal (a wrong current password, `429`) stays in the dialog
 * with the text of the BFF, and the user can try again; a success closes it.
 */
@Injectable({ providedIn: 'root' })
export class EpicAuthPasswordChangeDialogService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly notificationService = inject(EpicNotificationService)
    protected readonly authApiClient = inject(EpicAuthApiClient)

    openDialog(): MatDialogRef<EpicAuthPasswordChangeDialogComponent> {
        const dialogRef = MatDialogHelpers.openDialog<EpicAuthPasswordChangeDialogComponent>(
            this.dialog,
            EpicAuthPasswordChangeDialogComponent,
            {},
            MatDialogHelpers.getDefaultConfig(MatDialogHelpers.DialogSize.Small),
        )
        const component = dialogRef.componentInstance

        component.submit$
            .pipe(
                takeUntil(component.destroyed$),
                exhaustMap((formData) => {
                    component.isProcessing = true
                    return this.authApiClient.changeOwnPassword(Form.toRequest(formData))
                        .pipe(
                            map(() => true),
                            catchError((error: unknown) => {
                                component.processingError = toEpicApiErrorMessage(error)
                                component.isProcessing = false
                                return of(false)
                            }),
                        )
                }),
            )
            .subscribe((isChanged) => {
                if (isChanged) {
                    dialogRef.close()
                    this.notificationService.success('Your password is changed.', 'Password')
                }
            })

        return dialogRef
    }

}
