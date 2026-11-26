import { Transform, TransformFnParams } from 'class-transformer'
import { IsBoolean, IsEnum, IsOptional, IsString, Length, Matches } from 'class-validator'
import { EpicUserRole } from 'svt-ts-types'
import { EpicUserCreate, SvtDbAgentKafkaUsers } from 'svt-ts-types/kafka'


/** The longest password hash that the column `SvtUser.passwordHash` holds. */
export const SVT_DB_AGENT_NEXT_PASSWORD_HASH_MAX_LENGTH = 255

/** The characters of a login, after lower-casing. */
const LOGIN_PATTERN = /^[a-z0-9._-]+$/

/** The value the agent compares and stores for a login: trimmed, in lower case. */
export function normalizeUserLogin(login: string): string {
    return login.trim().toLowerCase()
}

function trimmed({ value }: TransformFnParams): unknown {
    return typeof value === 'string' ? value.trim() : value
}

/** `data.create` of `CreateUser`. `login` and `name` are checked, and stored, trimmed; `login` in lower case. */
export class SvtDbAgentNextUserCreateDto implements EpicUserCreate {

    @Transform(({ value }) => (typeof value === 'string' ? normalizeUserLogin(value) : value))
    @IsString()
    @Length(3, 50)
    @Matches(LOGIN_PATTERN)
    login!: string

    @Transform(trimmed)
    @IsString()
    @Length(1, 100)
    name!: string

    @IsEnum(EpicUserRole)
    role!: EpicUserRole

    @IsString()
    @Length(1, SVT_DB_AGENT_NEXT_PASSWORD_HASH_MAX_LENGTH)
    passwordHash!: string

}

/** `data.update` of `UpdateUser`. Every key is optional; `null` is the same as an absent key. No `login`. */
export class SvtDbAgentNextUserUpdateDto implements SvtDbAgentKafkaUsers.UserUpdate {

    @IsOptional()
    @Transform(trimmed)
    @IsString()
    @Length(1, 100)
    name?: string

    @IsOptional()
    @IsEnum(EpicUserRole)
    role?: EpicUserRole

    @IsOptional()
    @IsBoolean()
    isActive?: boolean

}
