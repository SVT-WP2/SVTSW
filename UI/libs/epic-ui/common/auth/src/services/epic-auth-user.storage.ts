import { Injectable } from '@angular/core'

import { EpicAuth } from '../models'


@Injectable({ providedIn: 'root' })
export class EpicAuthUserStorage {

    protected readonly storageUserKey = 'epic.user'

    getUser(): EpicAuth.UserInfo | null {
        const userInfoStr = localStorage.getItem(this.storageUserKey)
        return userInfoStr
            ? JSON.parse(userInfoStr) as EpicAuth.UserInfo
            : null
    }

    setUser(user: EpicAuth.UserInfo): void {
        const userInfoStr = JSON.stringify(user)
        localStorage.setItem(this.storageUserKey, userInfoStr)
    }

    clear(): void {
        localStorage.removeItem(this.storageUserKey)
    }


}
