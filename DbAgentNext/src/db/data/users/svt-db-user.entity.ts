import { OptionalProps } from '@mikro-orm/core'
import { Check, Entity, Enum, PrimaryKey, Property } from '@mikro-orm/decorators/legacy'

import { SVT_DB_ENUM_VALUES } from '../enums'


/**
 * `main."SvtUser"`: a user of the installation. `id` is the user id that other services point to. `login` is
 * unique and follows the login rule of the agent (3 to 50 characters of `a-z`, `0-9`, `.`, `_`, `-`): the agent
 * stores only such a login, and the check `SvtUser_login_check` makes the database refuse any other, also in a row
 * entered by hand. `role` is the enum `userRole`, whose four values the code depends on. `passwordHash` is an
 * opaque string made by the BFF; it is lazy, so a list never loads it, and only `GetUserCredentials` populates it.
 * A user is never deleted: `isActive` false switches it off. `createdAt` is `timestamp without time zone`, UTC,
 * stamped by the database.
 */
@Entity({ tableName: 'SvtUser' })
@Check({ name: 'SvtUser_login_check', expression: 'login ~ \'^[a-z0-9._-]{3,50}$\'' })
export class SvtDbUserEntity {

    @PrimaryKey({ type: 'integer', autoincrement: true, generated: 'by default as identity' })
    id!: number

    @Property({ type: 'string', length: 50, unique: true })
    login!: string

    @Property({ type: 'string', length: 100 })
    name!: string

    @Enum({ nativeEnumName: 'userRole', items: SVT_DB_ENUM_VALUES.userRole })
    role!: string

    @Property({ type: 'string', length: 255, lazy: true })
    passwordHash!: string

    @Property({ type: 'boolean', default: true })
    isActive!: boolean

    @Property({ type: 'datetime', columnType: 'timestamp', defaultRaw: 'CURRENT_TIMESTAMP' })
    createdAt!: Date;

    [OptionalProps]?: 'id' | 'isActive' | 'createdAt'

}
