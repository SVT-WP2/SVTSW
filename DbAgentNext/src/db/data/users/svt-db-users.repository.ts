import { FilterQuery, TransactionOptions } from '@mikro-orm/core'
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

/**
 * The key of the transaction-level advisory lock (`pg_advisory_xact_lock`) that `update` takes. No other code of
 * the agent takes an advisory lock. The value has no meaning: it is the number of the ticket.
 */
export const SVT_DB_USERS_UPDATE_LOCK = 393

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

    /**
     * A new, active user, or `null` when the login exists already. The database sets `id` and `createdAt`. A
     * duplicate login is no failing statement (`ON CONFLICT (login) DO NOTHING`): PostgreSQL logs the text of a
     * failing statement, and the text holds the hash. Two creates of one login at the same time give one user.
     */
    create(input: SvtDbUserCreateInput): Promise<SvtDbUserEntity | null> {
        return this.em.transactional(async (em) => {
            const result = await em.createQueryBuilder(SvtDbUserEntity)
                .insert({ ...input, isActive: true })
                .onConflict('login')
                .ignore()
                .returning('id')
                .execute('run')
            // PostgreSQL returns the new id through `RETURNING`; a login that exists already returns no row.
            const id = result.row?.['id'] as number | undefined
            return id === undefined ? null : em.findOneOrFail(SvtDbUserEntity, { id })
        }, WITHOUT_QUERY_LOG)
    }

    /**
     * Changes the user, unless the change takes away the last active Admin (`removesLastActiveAdmin`). The check
     * and the write are in one transaction, which first takes one advisory lock: the updates of users run one at a
     * time, so two updates at the same time cannot both remove an Admin of the last two. The lock is the only one
     * taken before the write, so it cannot deadlock with another update, and it locks no row of a user.
     */
    update(id: number, patch: SvtDbUserUpdateInput): Promise<SvtDbUserUpdateResult> {
        return this.em.transactional(async (em): Promise<SvtDbUserUpdateResult> => {
            await em.execute('select pg_advisory_xact_lock(?)', [SVT_DB_USERS_UPDATE_LOCK])
            const user = await em.findOne(SvtDbUserEntity, { id })
            if (!user) {
                return { outcome: 'notFound' }
            }
            const after = { role: patch.role ?? user.role, isActive: patch.isActive ?? user.isActive }
            const otherActiveAdmins = await em.count(SvtDbUserEntity, {
                role: SVT_DB_USER_ROLE_ADMIN,
                isActive: true,
                id: { $ne: id },
            })
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
