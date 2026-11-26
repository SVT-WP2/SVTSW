import { FilterQuery, LockMode, TransactionOptions } from '@mikro-orm/core'
import { EntityManager } from '@mikro-orm/postgresql'
import { Injectable } from '@nestjs/common'

import { SvtDbPage, SvtDbPager } from '../common'

import { removesLastActiveAdmin, SVT_DB_USER_ROLE_ADMIN } from './svt-db-user-rules'
import { SvtDbUserEntity } from './svt-db-user.entity'


/**
 * A transaction that writes a password hash logs none of its queries. With the debug log on
 * (`SVT_DB_AGENT_LOGGER_TERM_VERBOSITY=DEBUG`), MikroORM logs each query with its values, and the values hold the
 * hash.
 */
const WITHOUT_QUERY_LOG: TransactionOptions = { loggerContext: { enabled: false } }

export type SvtDbUsersFilter = {
    ids?: number[]
    roles?: string[]
    isActive?: boolean
}

export type SvtDbUserCreateInput = {
    login: string
    name: string
    role: string
    passwordHash: string
}

/** The columns that `UpdateUser` can change. An absent key keeps the value. */
export type SvtDbUserUpdateInput = {
    name?: string
    role?: string
    isActive?: boolean
}

export type SvtDbUserUpdateResult =
    | { outcome: 'updated'; user: SvtDbUserEntity }
    | { outcome: 'notFound' }
    | { outcome: 'lastActiveAdmin' }

@Injectable()
export class SvtDbUsersRepository {

    constructor(private readonly em: EntityManager) {
    }

    /** The users in id order. The password hash is lazy, so the page does not load it. */
    async findPage(filter: SvtDbUsersFilter = {}, pager?: SvtDbPager): Promise<SvtDbPage<SvtDbUserEntity>> {
        const where: FilterQuery<SvtDbUserEntity> = {}
        if (filter.ids?.length) {
            where.id = { $in: filter.ids }
        }
        if (filter.roles?.length) {
            where.role = { $in: filter.roles }
        }
        if (filter.isActive !== undefined) {
            where.isActive = filter.isActive
        }
        const [items, totalCount] = await this.em.findAndCount(SvtDbUserEntity, where, {
            orderBy: { id: 'asc' },
            limit: pager?.limit,
            offset: pager?.offset,
        })
        return { items, totalCount }
    }

    /** The user with this login, with its password hash. `login` is already trimmed and in lower case. */
    findCredentialsByLogin(login: string): Promise<SvtDbUserEntity | null> {
        return this.em.findOne(SvtDbUserEntity, { login }, { populate: ['passwordHash'] })
    }

    /** A new, active user. The database sets `id` and `createdAt`. */
    create(input: SvtDbUserCreateInput): Promise<SvtDbUserEntity> {
        return this.em.transactional(async (em) => {
            const user = em.create(SvtDbUserEntity, { ...input, isActive: true })
            await em.flush()
            return user
        }, WITHOUT_QUERY_LOG)
    }

    /**
     * Changes the user, unless the change takes away the last active Admin (`removesLastActiveAdmin`). The check
     * and the write are in one transaction. It first locks the active Admins, in id order, and then the user: two
     * updates at the same time cannot both remove an Admin of the last two, and they lock the rows in the same
     * order, so they cannot deadlock.
     */
    update(id: number, patch: SvtDbUserUpdateInput): Promise<SvtDbUserUpdateResult> {
        return this.em.transactional(async (em): Promise<SvtDbUserUpdateResult> => {
            const activeAdmins = await em.find(
                SvtDbUserEntity,
                { role: SVT_DB_USER_ROLE_ADMIN, isActive: true },
                { orderBy: { id: 'asc' }, lockMode: LockMode.PESSIMISTIC_WRITE },
            )
            const user = await em.findOne(SvtDbUserEntity, { id }, { lockMode: LockMode.PESSIMISTIC_WRITE })
            if (!user) {
                return { outcome: 'notFound' }
            }
            const after = { role: patch.role ?? user.role, isActive: patch.isActive ?? user.isActive }
            const otherActiveAdmins = activeAdmins.filter((admin) => admin.id !== id).length
            if (removesLastActiveAdmin(user, after, otherActiveAdmins)) {
                return { outcome: 'lastActiveAdmin' }
            }
            em.assign(user, patch)
            await em.flush()
            return { outcome: 'updated', user }
        })
    }

    /** `null` when the user does not exist. */
    updatePasswordHash(id: number, passwordHash: string): Promise<SvtDbUserEntity | null> {
        return this.em.transactional(async (em) => {
            const user = await em.findOne(SvtDbUserEntity, { id })
            if (!user) {
                return null
            }
            user.passwordHash = passwordHash
            await em.flush()
            return user
        }, WITHOUT_QUERY_LOG)
    }

}
