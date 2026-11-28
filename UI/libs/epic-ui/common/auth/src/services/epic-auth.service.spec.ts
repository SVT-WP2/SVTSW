import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { firstValueFrom } from 'rxjs'
import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'

import { EpicAuthMessages, EpicAuthService } from './epic-auth.service'


describe('EpicAuthService', () => {

    const jane: EpicAuthUser = { id: 7, login: 'jane.doe', name: 'Jane Doe', role: EpicUserRole.Expert }

    let service: EpicAuthService
    let http: HttpTestingController

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting()],
        })
        service = TestBed.inject(EpicAuthService)
        http = TestBed.inject(HttpTestingController)
    })

    afterEach(() => {
        http.verify()
        localStorage.clear()
    })

    describe('login', () => {

        it('posts the login and the password to the BFF and keeps the user in memory only', async () => {
            const result = firstValueFrom(service.login('jane.doe', 'secret-of-the-test'))

            const request = http.expectOne('/api/auth/login')
            expect(request.request.method).toBe('POST')
            expect(request.request.body).toEqual({ login: 'jane.doe', password: 'secret-of-the-test' })
            request.flush(jane)

            expect(await result).toEqual(jane)
            expect(service.user).toEqual(jane)
            expect(service.isLoggedIn).toBe(true)
            expect(localStorage.length).toBe(0)
        })

        it.each([
            [401, { statusCode: 401, message: 'Unknown combination login/password.' }, EpicAuthMessages.LOGIN_FAILED],
            [401, null, EpicAuthMessages.LOGIN_FAILED],
            [429, { statusCode: 429, message: 'Too many attempts. Try again in a minute.' }, EpicAuthMessages.TOO_MANY_ATTEMPTS],
            [500, { statusCode: 500, message: 'Internal server error' }, EpicAuthMessages.LOGIN_UNAVAILABLE],
            [0, null, EpicAuthMessages.LOGIN_UNAVAILABLE],
        ])('turns a %s into the text "%s"', async (status, body, text) => {
            const result = firstValueFrom(service.login('jane.doe', 'wrong'))

            http.expectOne('/api/auth/login').flush(body, { status, statusText: 'Failed' })

            await expect(result).rejects.toThrow(text)
            expect(service.isLoggedIn).toBe(false)
        })

    })

    describe('authorize', () => {

        it('asks GET /api/auth/me once and remembers the user', async () => {
            const first = firstValueFrom(service.authorize())
            const second = firstValueFrom(service.authorize())
            http.expectOne('/api/auth/me').flush(jane)

            expect(await first).toEqual({ isAuthorized: true, user: jane })
            expect(await second).toEqual({ isAuthorized: true, user: jane })
            expect(await firstValueFrom(service.authorize())).toEqual({ isAuthorized: true, user: jane })
            expect(service.user).toEqual(jane)
        })

        it('remembers a 401 as "not logged in"', async () => {
            const first = firstValueFrom(service.authorize())
            http.expectOne('/api/auth/me').flush({ statusCode: 401, message: 'Unauthorized' }, { status: 401, statusText: 'Unauthorized' })

            expect(await first).toEqual({ isAuthorized: false })
            expect(await firstValueFrom(service.authorize())).toEqual({ isAuthorized: false })
            http.expectNone('/api/auth/me')
        })

        it('asks again after another failure (no BFF)', async () => {
            const first = firstValueFrom(service.authorize())
            http.expectOne('/api/auth/me').flush(null, { status: 504, statusText: 'Gateway Timeout' })
            expect(await first).toEqual({ isAuthorized: false })

            const second = firstValueFrom(service.authorize())
            http.expectOne('/api/auth/me').flush(jane)

            expect(await second).toEqual({ isAuthorized: true, user: jane })
        })

        it('answers from memory after a log-in, without asking', async () => {
            const login = firstValueFrom(service.login('jane.doe', 'secret-of-the-test'))
            http.expectOne('/api/auth/login').flush(jane)
            await login

            expect(await firstValueFrom(service.authorize())).toEqual({ isAuthorized: true, user: jane })
        })

    })

    describe('logout and clearUser', () => {

        async function loggedIn(): Promise<void> {
            const login = firstValueFrom(service.login('jane.doe', 'secret-of-the-test'))
            http.expectOne('/api/auth/login').flush(jane)
            await login
        }

        it('logout posts to the BFF, forgets the user and reloads the page', async () => {
            const reload = vi.spyOn(service, 'reloadPage').mockImplementation(() => undefined)
            await loggedIn()

            const logout = firstValueFrom(service.logout(), { defaultValue: undefined })
            const request = http.expectOne('/api/auth/logout')
            expect(request.request.method).toBe('POST')
            request.flush(null, { status: 204, statusText: 'No Content' })
            await logout

            expect(service.user).toBeNull()
            expect(reload).toHaveBeenCalledTimes(1)
        })

        it('logout after a 401 (the session had ended already) forgets the user and reloads too', async () => {
            const reload = vi.spyOn(service, 'reloadPage').mockImplementation(() => undefined)
            await loggedIn()

            const logout = firstValueFrom(service.logout(), { defaultValue: undefined })
            http.expectOne('/api/auth/logout').flush({ statusCode: 401 }, { status: 401, statusText: 'Unauthorized' })
            await logout

            expect(service.user).toBeNull()
            expect(reload).toHaveBeenCalledTimes(1)
        })

        it.each([
            [0, 'Unknown Error'],
            [502, 'Bad Gateway'],
            [500, 'Internal Server Error'],
        ])('logout that fails with %s keeps the user and the page, and errors with a text to show', async (status, statusText) => {
            const reload = vi.spyOn(service, 'reloadPage').mockImplementation(() => undefined)
            await loggedIn()

            const logout = firstValueFrom(service.logout(), { defaultValue: undefined })
            http.expectOne('/api/auth/logout').flush(null, { status, statusText })

            await expect(logout).rejects.toThrow(EpicAuthMessages.LOGOUT_FAILED)
            expect(service.user).toEqual(jane)
            expect(reload).not.toHaveBeenCalled()
        })

        it('clearUser forgets the user, and authorize then answers "not logged in" without asking', async () => {
            const me = firstValueFrom(service.authorize())
            http.expectOne('/api/auth/me').flush(jane)
            await me

            service.clearUser()

            expect(service.user).toBeNull()
            expect(await firstValueFrom(service.authorize())).toEqual({ isAuthorized: false })
            http.expectNone('/api/auth/me')
        })

    })

})
