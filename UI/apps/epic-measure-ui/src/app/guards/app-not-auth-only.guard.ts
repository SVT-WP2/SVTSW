import { inject } from '@angular/core'
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree } from '@angular/router'
import { EpicAuthService } from 'epic-ui/common/auth'
import { map, Observable } from 'rxjs'


export namespace AppNotAuthOnlyGuard {

    export const canActivate: CanActivateFn = (
        activatedRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): Observable<boolean | UrlTree> => {
        const epicAuthService = inject(EpicAuthService)
        const router = inject(Router)

        return epicAuthService.authorize()
            .pipe(
                map(({ isAuthorized }) => {
                    if (isAuthorized) {
                        return router.createUrlTree(['/'])
                    }
                    return true
                }),
            )
    }

}
