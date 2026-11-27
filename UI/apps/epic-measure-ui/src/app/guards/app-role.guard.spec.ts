import { TestBed } from '@angular/core/testing'
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router'
import { EpicAuthAuthorization, EpicAuthService } from 'epic-ui/common/auth'
import { firstValueFrom, isObservable, Observable, of } from 'rxjs'
import { EpicAuthUser, EpicUserRole } from 'svt-ts-types'

import { AppRoleGuard } from './app-role.guard'


describe('AppRoleGuard', () => {

    let authorization: EpicAuthAuthorization

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideRouter([]),
                { provide: EpicAuthService, useValue: { authorize: () => of(authorization) } },
            ],
        })
    })

    function userOf(role: EpicUserRole): EpicAuthUser {
        return { id: 1, login: 'someone', name: 'Someone', role }
    }

    /** The answer of the guard for `minimum`, as a URL string when it redirects. */
    async function run(minimum: EpicUserRole, redirectTo?: string): Promise<true | string> {
        const guard = AppRoleGuard.canActivate(minimum, redirectTo)
        const result = TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot))
        const value = isObservable(result) ? await firstValueFrom(result as Observable<boolean | UrlTree>) : await result
        if (value === true) {
            return true
        }
        return TestBed.inject(Router).serializeUrl(value as UrlTree)
    }

    it('lets the minimum role and the roles above it through', async () => {
        for (const role of [EpicUserRole.Developer, EpicUserRole.Admin]) {
            authorization = { isAuthorized: true, user: userOf(role) }

            expect(await run(EpicUserRole.Developer), role).toBe(true)
        }
    })

    it('sends a role below the minimum to /admin', async () => {
        for (const role of [EpicUserRole.User, EpicUserRole.Expert, EpicUserRole.Developer]) {
            authorization = { isAuthorized: true, user: userOf(role) }

            expect(await run(EpicUserRole.Admin), role).toBe('/admin')
        }
    })

    it('takes another place to send a role below the minimum to', async () => {
        authorization = { isAuthorized: true, user: userOf(EpicUserRole.User) }

        expect(await run(EpicUserRole.Expert, '/wafers')).toBe('/wafers')
    })

    it('sends a user who is not logged in to the log-in page', async () => {
        authorization = { isAuthorized: false }

        expect(await run(EpicUserRole.User)).toBe('/auth/login')
    })

    it('refuses a role that it does not know', async () => {
        authorization = { isAuthorized: true, user: userOf('Root' as EpicUserRole) }

        expect(await run(EpicUserRole.User)).toBe('/admin')
    })

})
