import { HttpErrorResponse } from '@angular/common/http'
import { EventEmitter } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MatDialog } from '@angular/material/dialog'
import { EpicAuthApiClient } from 'epic-ui/api'
import { EpicNotificationService } from 'epic-ui/common/components'
import { of, Subject, throwError } from 'rxjs'

import { EpicAuthPasswordChangeDialogService } from './epic-auth-password-change-dialog.service'


describe('EpicAuthPasswordChangeDialogService', () => {

    const component = {
        submit$: new EventEmitter<any>(),
        destroyed$: new Subject<void>(),
        isProcessing: false,
        processingError: null as string | null,
    }
    const dialogRef = { componentInstance: component, close: vi.fn() }
    const api = { changeOwnPassword: vi.fn() }
    const notifications = { success: vi.fn() }
    let service: EpicAuthPasswordChangeDialogService

    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(component, {
            submit$: new EventEmitter<any>(),
            destroyed$: new Subject<void>(),
            isProcessing: false,
            processingError: null,
        })
        TestBed.configureTestingModule({
            providers: [
                { provide: MatDialog, useValue: { open: vi.fn(() => dialogRef) } },
                { provide: EpicAuthApiClient, useValue: api },
                { provide: EpicNotificationService, useValue: notifications },
            ],
        })
        service = TestBed.inject(EpicAuthPasswordChangeDialogService)
    })

    const formData = { currentPassword: 'the-current-one', newPassword: 'the-new-one', repeatPassword: 'the-new-one' }

    it('shows a wrong current password in the dialog, then changes it on the next submit and says so', () => {
        api.changeOwnPassword
            .mockReturnValueOnce(throwError(() => new HttpErrorResponse({
                status: 400,
                error: { statusCode: 400, message: 'The current password is wrong.', error: 'Bad Request' },
            })))
            .mockReturnValueOnce(of(undefined))
        service.openDialog()

        component.submit$.emit(formData)

        expect(component.processingError).toBe('The current password is wrong.')
        expect(component.isProcessing).toBe(false)
        expect(dialogRef.close).not.toHaveBeenCalled()

        component.submit$.emit(formData)

        expect(api.changeOwnPassword).toHaveBeenLastCalledWith({ currentPassword: 'the-current-one', newPassword: 'the-new-one' })
        expect(dialogRef.close).toHaveBeenCalled()
        expect(notifications.success).toHaveBeenCalledWith('Your password is changed.', 'Password')
    })

    it('shows the 429 of a locked login with the text of the BFF', () => {
        api.changeOwnPassword.mockReturnValue(throwError(() => new HttpErrorResponse({
            status: 429,
            error: { statusCode: 429, message: 'Too many attempts. Try again in a minute.', error: 'Too Many Requests' },
        })))
        service.openDialog()

        component.submit$.emit(formData)

        expect(component.processingError).toBe('Too many attempts. Try again in a minute.')
    })

})
