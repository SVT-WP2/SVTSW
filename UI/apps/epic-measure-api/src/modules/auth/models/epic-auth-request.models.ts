import type { Request } from 'express'
import { EpicAuthUser, EpicUser } from 'svt-ts-types'


/** An HTTP request after `EpicAuthGuard`: `user` is the logged-in user (absent on a public route). */
export type EpicAuthRequest = Request & {
    user?: EpicAuthUser
}

/** The user as the browser may see it: no hash, no `isActive`, no `createdAt`. */
export function toEpicAuthUser(user: Pick<EpicUser, 'id' | 'login' | 'name' | 'role'>): EpicAuthUser {
    return { id: user.id, login: user.login, name: user.name, role: user.role }
}
