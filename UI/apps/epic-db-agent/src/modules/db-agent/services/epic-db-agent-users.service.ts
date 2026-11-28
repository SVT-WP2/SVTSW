import { Injectable } from '@nestjs/common'
import { hashEpicPassword } from 'epic/core'
import { delay, from, map, Observable } from 'rxjs'
import { EpicUser, EpicUserRole } from 'svt-ts-types'
import { EpicKafkaReplyStatus, EpicUserCreate, EpicUserCredentials, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'


import Users = SvtDbAgentKafkaUsers


/** The login rule of the DB agent (`DbAgentNext/docs/messages.md` §3.18), after trimming and lower-casing. */
const LOGIN_RULE = /^[a-z0-9._-]{3,50}$/

/**
 * The users of the mock DB agent: one per role, each with the password equal to its login (`admin` / `admin`, …).
 * For development on a laptop only: the mock never ships.
 */
const MOCK_USERS: { login: string; name: string; role: EpicUserRole }[] = [
    { login: 'admin', name: 'Mock Admin', role: EpicUserRole.Admin },
    { login: 'developer', name: 'Mock Developer', role: EpicUserRole.Developer },
    { login: 'expert', name: 'Mock Expert', role: EpicUserRole.Expert },
    { login: 'user', name: 'Mock User', role: EpicUserRole.User },
]

/**
 * The five user messages (`GetAllUsers`, `GetUserCredentials`, `CreateUser`, `UpdateUser`, `UpdateUserPassword`) on a
 * list in memory, with the answers of the DB agent for the cases the UI meets: an unknown login or id (`NotFound`), a
 * login that exists already or breaks the rule, and the last active Admin (`BadRequest`). Each method answers the
 * whole reply message.
 */
@Injectable()
export class EpicDbAgentUsersService {

    protected users: EpicUserCredentials[] = []

    private readonly ready: Promise<void>

    constructor() {
        this.ready = this.seed()
    }

    getAll(data?: Users.GetAllUsersMessageData): Observable<Users.GetAllUsersReplyMessage> {
        return this.whenReady(() => {
            const filter = data?.filter ?? {}
            const items = this.users
                .filter((user) => !filter.ids || filter.ids.includes(user.id))
                .filter((user) => !filter.roles || filter.roles.includes(user.role))
                .filter((user) => filter.isActive === undefined || user.isActive === filter.isActive)
            const offset = data?.pager?.offset ?? 0
            const limit = data?.pager?.limit ?? items.length
            return new Users.GetAllUsersReplyMessage({
                items: items.slice(offset, offset + limit).map(toWire),
                totalCount: items.length,
            })
        })
    }

    getCredentials(login: string): Observable<Users.GetUserCredentialsReplyMessage> {
        return this.whenReady(() => {
            const user = this.users.find((item) => item.login === normalizeLogin(login))
            return user
                ? new Users.GetUserCredentialsReplyMessage({ entity: { ...user } })
                : new Users.GetUserCredentialsReplyMessage(undefined, EpicKafkaReplyStatus.NotFound, { message: 'No user with this login' })
        })
    }

    create(create: EpicUserCreate): Observable<Users.CreateUserReplyMessage> {
        return this.whenReady(() => {
            const login = normalizeLogin(create.login)
            if (!LOGIN_RULE.test(login)) {
                return new Users.CreateUserReplyMessage(undefined, EpicKafkaReplyStatus.BadRequest, {
                    message: 'data.create: login must be 3 to 50 characters of a-z, 0-9, ".", "_" and "-"',
                })
            }
            if (this.users.some((user) => user.login === login)) {
                return new Users.CreateUserReplyMessage(undefined, EpicKafkaReplyStatus.BadRequest, {
                    message: 'Unique constraint violated',
                })
            }
            const user: EpicUserCredentials = {
                id: Math.max(0, ...this.users.map((item) => item.id)) + 1,
                login,
                name: create.name.trim(),
                role: create.role,
                isActive: true,
                createdAt: new Date().toISOString(),
                passwordHash: create.passwordHash,
            }
            this.users.push(user)
            return new Users.CreateUserReplyMessage({ entity: toWire(user) })
        })
    }

    update(id: number, update: Users.UserUpdate): Observable<Users.UpdateUserReplyMessage> {
        return this.whenReady(() => {
            const user = this.users.find((item) => item.id === id)
            if (!user) {
                return new Users.UpdateUserReplyMessage(undefined, EpicKafkaReplyStatus.NotFound, { message: `No user with id ${id}` })
            }
            const changed = {
                ...user,
                ...(update.name !== undefined && update.name !== null ? { name: update.name.trim() } : {}),
                ...(update.role !== undefined && update.role !== null ? { role: update.role } : {}),
                ...(update.isActive !== undefined && update.isActive !== null ? { isActive: update.isActive } : {}),
            }
            const isActiveAdmin = (item: EpicUserCredentials) => item.isActive && item.role === EpicUserRole.Admin
            if (isActiveAdmin(user) && !isActiveAdmin(changed) && !this.users.some((item) => item.id !== id && isActiveAdmin(item))) {
                return new Users.UpdateUserReplyMessage(undefined, EpicKafkaReplyStatus.BadRequest, {
                    message: 'The installation must keep one active Admin',
                })
            }
            Object.assign(user, changed)
            return new Users.UpdateUserReplyMessage({ entity: toWire(user) })
        })
    }

    updatePassword(id: number, passwordHash: string): Observable<Users.UpdateUserPasswordReplyMessage> {
        return this.whenReady(() => {
            const user = this.users.find((item) => item.id === id)
            if (!user) {
                return new Users.UpdateUserPasswordReplyMessage(undefined, EpicKafkaReplyStatus.NotFound, {
                    message: `No user with id ${id}`,
                })
            }
            user.passwordHash = passwordHash
            return new Users.UpdateUserPasswordReplyMessage({ entity: toWire(user) })
        })
    }

    private whenReady<T>(answer: () => T): Observable<T> {
        return from(this.ready).pipe(map(answer), delay(50))
    }

    private async seed(): Promise<void> {
        const createdAt = new Date().toISOString()
        this.users = await Promise.all(MOCK_USERS.map(async (user, index) => ({
            id: index + 1,
            ...user,
            isActive: true,
            createdAt,
            passwordHash: await hashEpicPassword(user.login),
        })))
    }

}

function normalizeLogin(login: string): string {
    return login.trim().toLowerCase()
}

/** A user as every service may see it: never the hash. */
function toWire(user: EpicUserCredentials): EpicUser {
    const { passwordHash, ...wire } = user
    return wire
}
