import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsString, Length, MaxLength } from 'class-validator'
import { EPIC_USER_PASSWORD_MAX_LENGTH, EPIC_USER_PASSWORD_MIN_LENGTH, EpicUserCreateRequest, EpicUserRole } from 'svt-ts-types'

import { TransformKeepPlainValue } from '../../common'


/**
 * The body of `POST /api/users`. The DB agent checks the login rule and the name rule; the BFF checks the role and
 * the length of the password, which it hashes. The upper bounds of the login and the name only bound the work.
 */
export class EpicUserCreateRequestDto implements EpicUserCreateRequest {

    /** Above the login rule (50 after trimming): a longer text is refused before it is lower-cased and sent. */
    static readonly LOGIN_MAX_LENGTH = 100
    /** Above the name rule (100 after trimming). */
    static readonly NAME_MAX_LENGTH = 1000

    @ApiProperty({ type: 'string', description: '3 to 50 characters of a-z, 0-9, ".", "_" and "-", after trimming and lower-casing' })
    @TransformKeepPlainValue()
    @IsString()
    @MaxLength(EpicUserCreateRequestDto.LOGIN_MAX_LENGTH)
    login: string

    @ApiProperty({ type: 'string', description: '1 to 100 characters after trimming' })
    @TransformKeepPlainValue()
    @IsString()
    @MaxLength(EpicUserCreateRequestDto.NAME_MAX_LENGTH)
    name: string

    @ApiProperty({ enum: EpicUserRole })
    @TransformKeepPlainValue()
    @IsEnum(EpicUserRole)
    role: EpicUserRole

    @ApiProperty({ type: 'string', format: 'password', minLength: EPIC_USER_PASSWORD_MIN_LENGTH, maxLength: EPIC_USER_PASSWORD_MAX_LENGTH })
    @TransformKeepPlainValue()
    @IsString()
    @Length(EPIC_USER_PASSWORD_MIN_LENGTH, EPIC_USER_PASSWORD_MAX_LENGTH)
    password: string

}
