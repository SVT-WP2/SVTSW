import { inject, Injectable, Type } from '@angular/core'
import { MatDialog, MatDialogRef } from '@angular/material/dialog'
import { EpicUsersApiClient, toEpicApiErrorMessage } from 'epic-ui/api'
import { EpicAuthService } from 'epic-ui/common/auth'
import { EpicNotificationService } from 'epic-ui/common/components'
import { MatDialogHelpers } from 'epic-ui/utils/material'
import { catchError, exhaustMap, map, Observable, of, takeUntil } from 'rxjs'
import { EpicUser } from 'svt-ts-types'

import {
    EpicUserCreateDialogComponent,
    EpicUserPasswordDialogComponent,
    EpicUserSwitchOffDialogComponent,
    EpicUserUpdateDialogComponent,
} from '../dialogs'
import { EpicUserCreateForm, EpicUserDialogs, EpicUserPasswordForm, EpicUsersRules } from '../models'

import DialogSize = MatDialogHelpers.DialogSize


/** A dialog that sends a request when it is submitted, and shows the text of a refusal. */
type EpicUserRequestDialog = {
    isProcessing: boolean
    processingError: string | null
    destroyed$: Observable<unknown>
}

/** What happens after a dialog succeeded (the page reloads its grid). */
export type EpicUserDialogOptions = {
    onSuccess?: (user: EpicUser) => void
}

/**
 * The dialogs of the users page. Each sends its request when it is submitted; a refusal of the BFF (a login that
 * exists, the last active Admin, a password that is too short) stays in the dialog with its text, so the Admin can
 * correct it and try again. A success closes the dialog and calls `onSuccess`.
 */
@Injectable({ providedIn: 'root' })
export class EpicUsersDialogsService {

    // DI
    protected readonly dialog = inject(MatDialog)
    protected readonly notificationService = inject(EpicNotificationService)
    protected readonly usersApiClient = inject(EpicUsersApiClient)
    protected readonly authService = inject(EpicAuthService)

    openCreateDialog(options: EpicUserDialogOptions = {}): MatDialogRef<EpicUserCreateDialogComponent> {
        const dialogRef = this.open<EpicUserCreateDialogComponent>(EpicUserCreateDialogComponent, {})
        this.sendOnSubmit(
            dialogRef,
            dialogRef.componentInstance.submit$,
            (formData) => this.usersApiClient.create(EpicUserCreateForm.toRequest(formData)),
            options,
        )
        return dialogRef
    }

    /** The edit dialog: name and role; the role of the own user cannot be changed. Nothing is sent when nothing changed. */
    openUpdateDialog(
        user: EpicUser,
        currentUserId: number | null,
        options: EpicUserDialogOptions = {},
    ): MatDialogRef<EpicUserUpdateDialogComponent> {
        const isOwnUser = EpicUsersRules.isOwnUser(user, currentUserId)
        const data: EpicUserDialogs.UpdateData = { user, isOwnUser }
        const dialogRef = this.open<EpicUserUpdateDialogComponent>(EpicUserUpdateDialogComponent, data)
        this.sendOnSubmit(
            dialogRef,
            dialogRef.componentInstance.submit$,
            (formData) => {
                const request = EpicUsersRules.toUpdateRequest(user, formData, isOwnUser)
                return request ? this.usersApiClient.update(user.id, request) : of(user)
            },
            {
                onSuccess: (updated) => {
                    if (isOwnUser) {
                        // The user menu shows the new name at once.
                        this.authService.updateCurrentUser(updated)
                    }
                    options.onSuccess?.(updated)
                },
            },
        )
        return dialogRef
    }

    openPasswordDialog(user: EpicUser, options: EpicUserDialogOptions = {}): MatDialogRef<EpicUserPasswordDialogComponent> {
        const data: EpicUserDialogs.PasswordData = { user }
        const dialogRef = this.open<EpicUserPasswordDialogComponent>(EpicUserPasswordDialogComponent, data)
        this.sendOnSubmit(
            dialogRef,
            dialogRef.componentInstance.submit$,
            (formData) => this.usersApiClient.setPassword(user.id, EpicUserPasswordForm.toRequest(formData)),
            { onSuccess: (updated) => {
                this.notificationService.success(`The password of ${updated.login} is set.`, 'Users')
                options.onSuccess?.(updated)
            } },
        )
        return dialogRef
    }

    /** Asks before a user is switched off, and names it. The own user cannot be switched off (the button is disabled). */
    openSwitchOffDialog(user: EpicUser, options: EpicUserDialogOptions = {}): MatDialogRef<EpicUserSwitchOffDialogComponent> {
        const data: EpicUserDialogs.SwitchOffData = { user }
        const dialogRef = this.open<EpicUserSwitchOffDialogComponent>(EpicUserSwitchOffDialogComponent, data)
        this.sendOnSubmit(
            dialogRef,
            dialogRef.componentInstance.confirm$,
            () => this.usersApiClient.update(user.id, { isActive: false }),
            options,
        )
        return dialogRef
    }

    /** Switches a user on again, without a dialog; a refusal is a toast. */
    switchOn(user: EpicUser, options: EpicUserDialogOptions = {}): void {
        this.usersApiClient.update(user.id, { isActive: true })
            .subscribe({
                next: (updated) => {
                    this.notificationService.success(`${updated.login} can log in again.`, 'Users')
                    options.onSuccess?.(updated)
                },
                error: (error: unknown) => this.notificationService.error(toEpicApiErrorMessage(error), 'Users'),
            })
    }

    protected open<TComponent>(component: Type<TComponent>, data: Record<string, unknown>): MatDialogRef<TComponent> {
        return MatDialogHelpers.openDialog<TComponent>(this.dialog, component, data, MatDialogHelpers.getDefaultConfig(DialogSize.Small))
    }

    /**
     * Sends `request` for each submit (one at a time: a second click while one runs is ignored). A failure keeps the
     * dialog open with the text of the BFF; a success closes it.
     */
    protected sendOnSubmit<TComponent extends EpicUserRequestDialog, TValue>(
        dialogRef: MatDialogRef<TComponent>,
        submit$: Observable<TValue>,
        request: (value: TValue) => Observable<EpicUser>,
        options: EpicUserDialogOptions,
    ): void {
        const component = dialogRef.componentInstance
        submit$
            .pipe(
                takeUntil(component.destroyed$),
                exhaustMap((value) => {
                    component.isProcessing = true
                    return request(value)
                        .pipe(
                            map((user): EpicUser | null => user),
                            catchError((error: unknown) => {
                                component.processingError = toEpicApiErrorMessage(error)
                                component.isProcessing = false
                                return of(null)
                            }),
                        )
                }),
            )
            .subscribe((user) => {
                if (user) {
                    dialogRef.close(user)
                    options.onSuccess?.(user)
                }
            })
    }

}
