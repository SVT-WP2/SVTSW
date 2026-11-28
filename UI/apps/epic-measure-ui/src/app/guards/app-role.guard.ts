import { inject } from '@angular/core'
import { CanActivateFn, Router, UrlTree } from '@angular/router'
import { EpicAuthService } from 'epic-ui/common/auth'
import { map, Observable } from 'rxjs'
import { EpicUserRole, isEpicUserRoleAtLeast } from 'svt-ts-types'


/**
 * A route for some roles only: `canActivate: [AppRoleGuard.canActivate(EpicUserRole.Admin)]`. A user below the
 * minimum role (User < Expert < Developer < Admin) goes to `redirectTo` (`/admin` by default), a user who is not logged
 * in to the log-in page. The SPA only hides what a role may not use: the BFF refuses it (`403`).
 */
export namespace AppRoleGuard {

    export const DEFAULT_REDIRECT = '/admin'

    export function canActivate(minimum: EpicUserRole, redirectTo: string = DEFAULT_REDIRECT): CanActivateFn {
        return (): Observable<boolean | UrlTree> => {
            const epicAuthService = inject(EpicAuthService)
            const router = inject(Router)

            return epicAuthService.authorize()
                .pipe(
                    map(({ isAuthorized, user }) => {
                        if (!isAuthorized || !user) {
                            return router.createUrlTree(['/auth/login'])
                        }
                        return isEpicUserRoleAtLeast(user.role, minimum) ? true : router.parseUrl(redirectTo)
                    }),
                )
        }
    }

}
