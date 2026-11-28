import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { firstValueFrom } from 'rxjs'

import { EpicAuthService } from '../services'

import { epicAuthInterceptor } from './epic-auth.interceptor'


describe('epicAuthInterceptor', () => {

    let http: HttpTestingController
    let client: HttpClient
    let authService: EpicAuthService
    let navigate: ReturnType<typeof vi.spyOn>
    let clearUser: ReturnType<typeof vi.spyOn>

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                provideHttpClient(withInterceptors([epicAuthInterceptor])),
                provideHttpClientTesting(),
            ],
        })
        http = TestBed.inject(HttpTestingController)
        client = TestBed.inject(HttpClient)
        authService = TestBed.inject(EpicAuthService)
        navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
        clearUser = vi.spyOn(authService, 'clearUser')
    })

    afterEach(() => {
        http.verify()
    })

    async function failWith(url: string, status: number): Promise<unknown> {
        const result = firstValueFrom(client.get(url)).catch((error: unknown) => error)
        http.expectOne(url).flush({ statusCode: status }, { status, statusText: 'Failed' })
        return result
    }

    it('a 401 of an /api request clears the user and goes to the log-in page; the caller still gets the error', async () => {
        const error = await failWith('/api/wafers?ids=1', 401)

        expect(error).toMatchObject({ status: 401 })
        expect(clearUser).toHaveBeenCalledTimes(1)
        expect(navigate).toHaveBeenCalledWith(['/auth/login'])
    })

    it.each(['/api/auth/login', '/api/auth/me'])('leaves the 401 of %s to its caller', async (url) => {
        await failWith(url, 401)

        expect(clearUser).not.toHaveBeenCalled()
        expect(navigate).not.toHaveBeenCalled()
    })

    it.each([
        ['a 403', '/api/users', 403],
        ['a 500', '/api/wafers', 500],
        ['a 401 of a request that is not to the BFF', '/assets/i18n/en.json', 401],
        ['a 401 of another origin', 'https://elsewhere.example/api/wafers', 401],
    ])('ignores %s', async (_, url, status) => {
        await failWith(url, status)

        expect(clearUser).not.toHaveBeenCalled()
        expect(navigate).not.toHaveBeenCalled()
    })

})
