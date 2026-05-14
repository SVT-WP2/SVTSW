import { inject, Injectable } from '@angular/core'
import { isEqual } from 'lodash-es'
import { BehaviorSubject, distinctUntilChanged, map, Observable, of, throwError } from 'rxjs'

import { EpicAuth } from '../models'

import { EpicAuthUserStorage } from './epic-auth-user.storage'


@Injectable({ providedIn: 'root' })
export class EpicAuthService {

    readonly user$: Observable<EpicAuth.UserInfo | null>
    readonly isLoggedIn$: Observable<boolean>

    private _user$ = new BehaviorSubject<EpicAuth.UserInfo | null>(null)

    private readonly epicAuthUserStorage = inject(EpicAuthUserStorage)

    constructor() {
        this.user$ = this._user$.asObservable()
        this.isLoggedIn$ = this.user$
            .pipe(
                map(user => !!user),
                distinctUntilChanged((left, right) => isEqual(left, right)),
            )
    }

    get user(): EpicAuth.UserInfo | null {
        return this._user$.getValue()
    }

    get isLoggedIn(): boolean {
        return !!this._user$.getValue()
    }

    login(login: string, password: string): Observable<EpicAuth.UserInfo> {
        const refUser = EpicAuth.getUsersList().find(item => item.login.toLowerCase() === login.toLowerCase())
        if (!refUser) {
            return throwError(() => new Error('Unknown combination login/password.'))
        }
        const passwordMatch = EpicAuth.comparePassword(EpicAuth.getUserPasswordHash(refUser.id), password)

        if (!passwordMatch) {
            return throwError(() => new Error('Unknown combination login/password.'))
        }

        this.epicAuthUserStorage.setUser(refUser)
        this._user$.next(refUser)
        return of(refUser)
    }

    authorize(): Observable<{ isAuthorized: boolean; user?: EpicAuth.UserInfo | null }> {
        if (this.isLoggedIn) {
            return of({
                isAuthorized: true,
                user: this.user,
            })
        }

        const user = this.epicAuthUserStorage.getUser()
        if (user === null) {
            return of({ isAuthorized: false })
        }

        this._user$.next(user)

        return of({
            isAuthorized: true,
            user,
        })

    }

    logout(): void {
        this.epicAuthUserStorage.clear()
        this._user$.next(null)
        window.location.reload()
    }

}
