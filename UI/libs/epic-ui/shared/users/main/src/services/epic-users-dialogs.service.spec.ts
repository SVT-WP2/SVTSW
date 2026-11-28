import { HttpErrorResponse } from '@angular/common/http'
import { EventEmitter } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { MatDialog } from '@angular/material/dialog'
import { EpicUsersApiClient } from 'epic-ui/api'
import { EpicAuthService } from 'epic-ui/common/auth'
import { EpicNotificationService } from 'epic-ui/common/components'
import { of, Subject, throwError } from 'rxjs'
import { EpicUser, EpicUserRole } from 'svt-ts-types'

import { EpicUsersDialogsService } from './epic-users-dialogs.service'


const JANE: EpicUser = {
    id: 7,
    login: 'jane.doe',
    name: 'Jane Doe',
    role: EpicUserRole.Expert,
    isActive: true,
    createdAt: '2026-11-27T08:00:00.000Z',
}

/** The answer of the BFF to a refused request, with the text of the DB agent. */
function refusal(message: string): HttpErrorResponse {
    return new HttpErrorResponse({ status: 400, error: { statusCode: 400, message, error: 'Bad Request' } })
}

describe('EpicUsersDialogsService', () => {

    const component = {
        submit$: new EventEmitter<any>(),
        confirm$: new EventEmitter<void>(),
        destroyed$: new Subject<void>(),
        isProcessing: false,
        processingError: null as string | null,
    }
    const dialogRef = { componentInstance: component, close: vi.fn() }
    const api = { create: vi.fn(), update: vi.fn(), setPassword: vi.fn() }
    const notifications = { success: vi.fn(), error: vi.fn() }
    const auth = { updateCurrentUser: vi.fn() }
    const onSuccess = vi.fn()
    let service: EpicUsersDialogsService

    beforeEach(() => {
        vi.clearAllMocks()
        Object.assign(component, {
            submit$: new EventEmitter<any>(),
            confirm$: new EventEmitter<void>(),
            destroyed$: new Subject<void>(),
            isProcessing: false,
            processingError: null,
        })
        TestBed.configureTestingModule({
            providers: [
                { provide: MatDialog, useValue: { open: vi.fn(() => dialogRef) } },
                { provide: EpicUsersApiClient, useValue: api },
                { provide: EpicNotificationService, useValue: notifications },
                { provide: EpicAuthService, useValue: auth },
            ],
        })
        service = TestBed.inject(EpicUsersDialogsService)
    })

    const createForm = {
        login: 'jane.doe',
        name: ' Jane Doe ',
        role: EpicUserRole.Expert,
        password: 'long-enough',
        repeatPassword: 'long-enough',
    }

    it('keeps the dialog open with the text of a refusal, and sends again on the next submit', () => {
        api.create.mockReturnValueOnce(throwError(() => refusal('an entry with the same unique value already exists')))
            .mockReturnValueOnce(of(JANE))
        service.openCreateDialog({ onSuccess })

        component.submit$.emit(createForm)

        expect(component.processingError).toBe('an entry with the same unique value already exists')
        expect(component.isProcessing).toBe(false)
        expect(dialogRef.close).not.toHaveBeenCalled()

        component.submit$.emit(createForm)

        expect(api.create).toHaveBeenCalledTimes(2)
        expect(api.create)
            .toHaveBeenLastCalledWith({ login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert, password: 'long-enough' })
        expect(dialogRef.close).toHaveBeenCalledWith(JANE)
        expect(onSuccess).toHaveBeenCalledWith(JANE)
    })

    it('ignores a second submit while a request runs', () => {
        const pending = new Subject<EpicUser>()
        api.create.mockReturnValue(pending)
        service.openCreateDialog()

        component.submit$.emit(createForm)
        component.submit$.emit(createForm)

        expect(api.create).toHaveBeenCalledTimes(1)
        expect(component.isProcessing).toBe(true)
    })

    it('sends only the name for the own row, and shows the new name in the user menu', () => {
        const renamed = { ...JANE, name: 'Jane D.' }
        api.update.mockReturnValue(of(renamed))
        service.openUpdateDialog(JANE, JANE.id, { onSuccess })

        component.submit$.emit({ name: 'Jane D.', role: EpicUserRole.Admin })

        expect(api.update).toHaveBeenCalledWith(JANE.id, { name: 'Jane D.' })
        expect(auth.updateCurrentUser).toHaveBeenCalledWith(renamed)
        expect(onSuccess).toHaveBeenCalledWith(renamed)
    })

    it('sends the role of another user, and leaves the user menu alone', () => {
        api.update.mockReturnValue(of({ ...JANE, role: EpicUserRole.Developer }))
        service.openUpdateDialog(JANE, 1)

        component.submit$.emit({ name: 'Jane Doe', role: EpicUserRole.Developer })

        expect(api.update).toHaveBeenCalledWith(JANE.id, { role: EpicUserRole.Developer })
        expect(auth.updateCurrentUser).not.toHaveBeenCalled()
    })

    it('sends nothing when nothing changed, and closes the dialog', () => {
        service.openUpdateDialog(JANE, 1)

        component.submit$.emit({ name: 'Jane Doe', role: EpicUserRole.Expert })

        expect(api.update).not.toHaveBeenCalled()
        expect(dialogRef.close).toHaveBeenCalledWith(JANE)
    })

    it('switches a user off on the confirmation, and shows the refusal of the last Admin', () => {
        api.update.mockReturnValue(throwError(() => refusal('The installation must keep one active Admin')))
        service.openSwitchOffDialog(JANE, { onSuccess })

        component.confirm$.emit()

        expect(api.update).toHaveBeenCalledWith(JANE.id, { isActive: false })
        expect(component.processingError).toBe('The installation must keep one active Admin')
        expect(onSuccess).not.toHaveBeenCalled()
    })

    it('sets a password and says so', () => {
        api.setPassword.mockReturnValue(of(JANE))
        service.openPasswordDialog(JANE)

        component.submit$.emit({ password: 'long-enough', repeatPassword: 'long-enough' })

        expect(api.setPassword).toHaveBeenCalledWith(JANE.id, { password: 'long-enough' })
        expect(notifications.success).toHaveBeenCalledWith('The password of jane.doe is set.', 'Users')
    })

    it('switches a user on without a dialog; a refusal is a toast', () => {
        api.update.mockReturnValueOnce(of({ ...JANE, isActive: true })).mockReturnValueOnce(throwError(() => refusal('No user with id 7')))

        service.switchOn({ ...JANE, isActive: false }, { onSuccess })
        service.switchOn({ ...JANE, isActive: false })

        expect(api.update).toHaveBeenCalledWith(JANE.id, { isActive: true })
        expect(onSuccess).toHaveBeenCalledTimes(1)
        expect(notifications.error).toHaveBeenCalledWith('No user with id 7', 'Users')
    })

})
