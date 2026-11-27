import { provideHttpClient } from '@angular/common/http'
import { TestBed } from '@angular/core/testing'
import { firstValueFrom } from 'rxjs'
import { EpicUserRole } from 'svt-ts-types'

import { EpicAuthMock } from '../../auth'
import { EpicUsersMock } from '../models'

import { EpicUsersApiClientMock } from './epic-users.api-client.mock'


describe('EpicUsersApiClientMock', () => {

    let client: EpicUsersApiClientMock

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [provideHttpClient(), EpicUsersApiClientMock] })
        client = TestBed.inject(EpicUsersApiClientMock)
    })

    it('starts with the four mock users of the log-in, active, in ascending order of id', async () => {
        const users = await firstValueFrom(client.fetchList())

        expect(users.map(({ id, login, name, role }) => ({ id, login, name, role }))).toEqual(EpicAuthMock.getUsers())
        expect(users.every((user) => user.isActive)).toBe(true)
        expect(users.map((user) => user.id)).toEqual([1, 2, 3, 4])
    })

    it('creates an active user with the login trimmed and in lower case, and lists it', async () => {
        const request = { login: ' Jane.DOE ', name: 'Jane', role: EpicUserRole.Expert, password: '12345678' }

        const user = await firstValueFrom(client.create(request))

        expect(user).toMatchObject({ id: 5, login: 'jane.doe', name: 'Jane', role: EpicUserRole.Expert, isActive: true })
        expect((await firstValueFrom(client.fetchList())).map((item) => item.login)).toContain('jane.doe')
    })

    it('answers 400 for a login that exists in another case, a login that breaks the rule, and a short password', async () => {
        const valid = { login: 'jane.doe', name: 'Jane', role: EpicUserRole.User, password: '12345678' }

        await expect(firstValueFrom(client.create({ ...valid, login: 'ADMIN' }))).rejects.toMatchObject({
            status: 400,
            error: { message: EpicUsersMock.Messages.DUPLICATE_LOGIN },
        })
        await expect(firstValueFrom(client.create({ ...valid, login: 'a b' }))).rejects.toMatchObject({ status: 400 })
        await expect(firstValueFrom(client.create({ ...valid, password: '1234567' }))).rejects.toMatchObject({ status: 400 })
        expect(await firstValueFrom(client.fetchList())).toHaveLength(4)
    })

    it('changes the name, the role and the state, and keeps the other keys', async () => {
        const updated = await firstValueFrom(client.update(4, { role: EpicUserRole.Developer }))
        const off = await firstValueFrom(client.update(4, { isActive: false }))

        expect(updated).toMatchObject({ id: 4, login: 'user', name: 'Mock User', role: EpicUserRole.Developer, isActive: true })
        expect(off).toMatchObject({ role: EpicUserRole.Developer, isActive: false })
    })

    it('keeps one active Admin: the only Admin cannot be switched off or lose the role', async () => {
        await expect(firstValueFrom(client.update(1, { isActive: false }))).rejects.toMatchObject({
            status: 400,
            error: { message: EpicUsersMock.Messages.LAST_ADMIN },
        })
        await expect(firstValueFrom(client.update(1, { role: EpicUserRole.User }))).rejects.toMatchObject({ status: 400 })

        await firstValueFrom(client.update(2, { role: EpicUserRole.Admin }))
        expect(await firstValueFrom(client.update(1, { isActive: false }))).toMatchObject({ isActive: false })
    })

    it('answers 404 for an unknown id, and sets a password of a known user', async () => {
        await expect(firstValueFrom(client.update(99, { name: 'Nobody' }))).rejects.toMatchObject({ status: 404 })
        await expect(firstValueFrom(client.setPassword(99, { password: '12345678' }))).rejects.toMatchObject({ status: 404 })
        await expect(firstValueFrom(client.setPassword(3, { password: 'short' }))).rejects.toMatchObject({ status: 400 })

        expect(await firstValueFrom(client.setPassword(3, { password: '12345678' }))).toMatchObject({ id: 3, login: 'expert' })
    })

})
