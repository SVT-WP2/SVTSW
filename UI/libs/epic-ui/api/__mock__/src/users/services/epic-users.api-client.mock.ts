import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http'
import { Injectable } from '@angular/core'
import { EpicUsersApiClient } from 'epic-ui/api'
import { defer, delay, Observable, of, throwError } from 'rxjs'
import {
    EPIC_USER_PASSWORD_MAX_LENGTH,
    EPIC_USER_PASSWORD_MIN_LENGTH,
    EpicUser,
    EpicUserCreateRequest,
    EpicUserPasswordSetRequest,
    EpicUserRole,
    EpicUserUpdateRequest,
    isEpicUserLogin,
    normalizeEpicUserLogin,
} from 'svt-ts-types'

import { EpicUsersMock } from '../models'


const DELAY_MS = 300

/**
 * The user management of the mock mode, with no backend: a list in memory that starts with the four mock users. It
 * answers as the BFF does: `400` with the text of the DB agent for a login that exists and for the last active
 * Admin, `400` for a password that is not 8 to 128 characters long, `404` for an unknown id. No password is kept.
 */
@Injectable()
export class EpicUsersApiClientMock extends EpicUsersApiClient {

    protected users: EpicUser[] = EpicUsersMock.getUsers()

    override fetchList(): Observable<EpicUser[]> {
        return defer(() => of(this.users.map((user) => ({ ...user }))))
            .pipe(
                delay(DELAY_MS),
            )
    }

    override create(request: EpicUserCreateRequest): Observable<EpicUser> {
        return defer(() => {
            const login = normalizeEpicUserLogin(request.login)
            if (!isEpicUserLogin(login)) {
                return throwError(() => badRequest('data.create: login must be 3 to 50 characters of a-z, 0-9, ".", "_" and "-"'))
            }
            if (this.users.some((user) => user.login === login)) {
                return throwError(() => badRequest(EpicUsersMock.Messages.DUPLICATE_LOGIN))
            }
            if (!isPasswordLength(request.password)) {
                return throwError(() => badRequest(passwordLengthMessage('password')))
            }
            const user: EpicUser = {
                id: Math.max(0, ...this.users.map((item) => item.id)) + 1,
                login,
                name: request.name.trim(),
                role: request.role,
                isActive: true,
                createdAt: new Date().toISOString(),
            }
            this.users = [...this.users, user]
            return of({ ...user })
        })
            .pipe(
                delay(DELAY_MS),
            )
    }

    override update(id: number, request: EpicUserUpdateRequest): Observable<EpicUser> {
        return defer(() => {
            const user = this.users.find((item) => item.id === id)
            if (!user) {
                return throwError(() => notFound(id))
            }
            const updated: EpicUser = {
                ...user,
                ...(request.name !== undefined ? { name: request.name.trim() } : {}),
                ...(request.role !== undefined ? { role: request.role } : {}),
                ...(request.isActive !== undefined ? { isActive: request.isActive } : {}),
            }
            if (this.leavesNoActiveAdmin(user, updated)) {
                return throwError(() => badRequest(EpicUsersMock.Messages.LAST_ADMIN))
            }
            this.users = this.users.map((item) => (item.id === id ? updated : item))
            return of({ ...updated })
        })
            .pipe(
                delay(DELAY_MS),
            )
    }

    override setPassword(id: number, request: EpicUserPasswordSetRequest): Observable<EpicUser> {
        return defer(() => {
            const user = this.users.find((item) => item.id === id)
            if (!isPasswordLength(request.password)) {
                return throwError(() => badRequest(passwordLengthMessage('password')))
            }
            return user ? of({ ...user }) : throwError(() => notFound(id))
        })
            .pipe(
                delay(DELAY_MS),
            )
    }

    /** The last-Admin rule of the DB agent: an active Admin may not be switched off or lose the role if it is the last. */
    protected leavesNoActiveAdmin(before: EpicUser, after: EpicUser): boolean {
        const isActiveAdmin = (user: EpicUser) => user.isActive && user.role === EpicUserRole.Admin
        if (!isActiveAdmin(before) || isActiveAdmin(after)) {
            return false
        }
        return !this.users.some((user) => user.id !== before.id && isActiveAdmin(user))
    }

}

function isPasswordLength(password: string): boolean {
    return typeof password === 'string'
        && password.length >= EPIC_USER_PASSWORD_MIN_LENGTH
        && password.length <= EPIC_USER_PASSWORD_MAX_LENGTH
}

function passwordLengthMessage(key: string): string {
    return `${key} must be ${EPIC_USER_PASSWORD_MIN_LENGTH} to ${EPIC_USER_PASSWORD_MAX_LENGTH} characters long`
}

function badRequest(message: string): HttpErrorResponse {
    return new HttpErrorResponse({
        status: HttpStatusCode.BadRequest,
        statusText: 'Bad Request',
        error: { statusCode: HttpStatusCode.BadRequest, message, error: 'Bad Request' },
    })
}

function notFound(id: number): HttpErrorResponse {
    return new HttpErrorResponse({
        status: HttpStatusCode.NotFound,
        statusText: 'Not Found',
        error: { statusCode: HttpStatusCode.NotFound, message: `No user with id ${id}`, error: 'Not Found' },
    })
}
