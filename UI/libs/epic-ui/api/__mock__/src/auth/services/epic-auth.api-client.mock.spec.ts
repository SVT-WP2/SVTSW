import { provideHttpClient } from '@angular/common/http'
import { TestBed } from '@angular/core/testing'
import { firstValueFrom } from 'rxjs'
import { EpicUserRole } from 'svt-ts-types'

import { EpicAuthMock } from '../models'

import { EpicAuthApiClientMock } from './epic-auth.api-client.mock'


describe('EpicAuthApiClientMock', () => {

    let client: EpicAuthApiClientMock

    beforeEach(() => {
        localStorage.clear()
        TestBed.configureTestingModule({ providers: [provideHttpClient()] })
        client = TestBed.inject(EpicAuthApiClientMock)
    })

    afterEach(() => {
        localStorage.clear()
    })

    it('knows one user per role', () => {
        expect(EpicAuthMock.getUsers().map((user) => user.role).sort())
            .toEqual([EpicUserRole.Admin, EpicUserRole.Developer, EpicUserRole.Expert, EpicUserRole.User].sort())
    })

    it('logs a mock user in with any password that is not empty, and keeps it over a reload', async () => {
        const user = await firstValueFrom(client.login({ login: ' Expert ', password: 'anything' }))

        expect(user.role).toBe(EpicUserRole.Expert)
        // A new instance, as after a reload of the page.
        const afterReload = TestBed.runInInjectionContext(() => new EpicAuthApiClientMock())
        expect(await firstValueFrom(afterReload.me())).toEqual(user)
        expect(localStorage.getItem(EpicAuthMock.STORAGE_KEY)).toBe('expert')
    })

    it('answers 401 for an unknown login, an empty password, and me() without a log-in', async () => {
        await expect(firstValueFrom(client.login({ login: 'nobody', password: 'anything' }))).rejects.toMatchObject({ status: 401 })
        await expect(firstValueFrom(client.login({ login: 'admin', password: '' }))).rejects.toMatchObject({ status: 401 })
        await expect(firstValueFrom(client.me())).rejects.toMatchObject({ status: 401 })
    })

    it('changes the own password with any current password that is not empty; 400 for an empty one, 401 without a log-in', async () => {
        await expect(firstValueFrom(client.changeOwnPassword({ currentPassword: 'x', newPassword: '12345678' })))
            .rejects.toMatchObject({ status: 401 })
        await firstValueFrom(client.login({ login: 'user', password: 'anything' }))

        await expect(firstValueFrom(client.changeOwnPassword({ currentPassword: '', newPassword: '12345678' }))).rejects.toMatchObject({
            status: 400,
            error: { message: 'The current password is wrong.' },
        })
        await expect(firstValueFrom(client.changeOwnPassword({ currentPassword: 'anything', newPassword: '12345678' })))
            .resolves.toBeUndefined()
    })

    it('forgets the user at the log-out', async () => {
        await firstValueFrom(client.login({ login: 'admin', password: 'anything' }))

        await firstValueFrom(client.logout())

        await expect(firstValueFrom(client.me())).rejects.toMatchObject({ status: 401 })
    })

})
