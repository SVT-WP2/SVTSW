import { EpicUser, EpicUserRole } from 'svt-ts-types'


/**
 * A user with the hash of the password: the reply of `GetUserCredentials`, which the BFF sends at log-in.
 * Kafka only: the hash never reaches the browser. The DB agent stores and returns the hash as an opaque string.
 */
export type EpicUserCredentials = EpicUser & {
    passwordHash: string
}

/**
 * `data.create` of the `CreateUser` Kafka message. Kafka only, because it holds the hash; the BFF makes the hash
 * from the password. A new user is active.
 */
export type EpicUserCreate = {
    login: string
    name: string
    role: EpicUserRole
    passwordHash: string
}
