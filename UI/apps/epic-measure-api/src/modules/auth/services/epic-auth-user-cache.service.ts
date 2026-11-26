import { Inject, Injectable } from '@nestjs/common'
import { firstValueFrom } from 'rxjs'
import { EpicAuthUser, EpicUser } from 'svt-ts-types'

import { EpicAuthConfig, EpicAuthSvc, toEpicAuthUser } from '../models'

import { EpicAuthUsersService } from './epic-auth-users.service'


type Entry = {
    expiresAt: number
    user: Promise<EpicUser | null>
}

/** Above this number of entries, every expired entry is dropped when a new one is added. */
const PRUNE_ABOVE = 1000

/**
 * The users that the guard has read, by id, for `SVT_UI_AUTH_USER_CACHE_SECONDS` (30 s by default): a request does
 * not cost a Kafka round trip, and a user who is switched off loses access within that time. Two requests at the
 * same time share one read. A failed read is not kept.
 */
@Injectable()
export class EpicAuthUserCacheService {

    private readonly entries = new Map<number, Entry>()

    constructor(
        @Inject(EpicAuthSvc.CONFIG) private readonly config: EpicAuthConfig,
        private readonly users: EpicAuthUsersService,
    ) {
    }

    /** The user with the id when it exists and is active; `null` otherwise. */
    async getActiveUser(id: number): Promise<EpicAuthUser | null> {
        const user = await this.entry(id).user
        return user?.isActive ? toEpicAuthUser(user) : null
    }

    /** Keeps a user that was just read some other way (a log-in), so the next request does not read it again. */
    remember(user: EpicUser): void {
        this.set(user.id, Promise.resolve(user))
    }

    /** Drops one user: its next request reads it again (ticket 396 calls it after a change of the user). */
    forget(id: number): void {
        this.entries.delete(id)
    }

    clear(): void {
        this.entries.clear()
    }

    private entry(id: number): Entry {
        const entry = this.entries.get(id)
        if (entry && entry.expiresAt > Date.now()) {
            return entry
        }
        const user = firstValueFrom(this.users.getById(id))
        const created = this.set(id, user)
        user.catch(() => {
            if (this.entries.get(id) === created) {
                this.entries.delete(id)
            }
        })
        return created
    }

    private set(id: number, user: Promise<EpicUser | null>): Entry {
        const now = Date.now()
        if (this.entries.size > PRUNE_ABOVE) {
            for (const [key, entry] of this.entries) {
                if (entry.expiresAt <= now) {
                    this.entries.delete(key)
                }
            }
        }
        const entry = { expiresAt: now + this.config.userCacheMs, user }
        this.entries.set(id, entry)
        return entry
    }

}
