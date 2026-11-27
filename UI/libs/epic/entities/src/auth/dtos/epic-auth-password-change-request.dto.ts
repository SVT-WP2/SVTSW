import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'
import { EPIC_USER_PASSWORD_MAX_LENGTH, EPIC_USER_PASSWORD_MIN_LENGTH, EpicAuthPasswordChangeRequest } from 'svt-ts-types'

import { TransformKeepPlainValue } from '../../common'


/** The body of `POST /api/auth/password`. The length of `currentPassword` only bounds the work, as at the log-in. */
export class EpicAuthPasswordChangeRequestDto implements EpicAuthPasswordChangeRequest {

    @ApiProperty({ type: 'string', format: 'password' })
    @TransformKeepPlainValue()
    @IsString()
    @Length(1, EPIC_USER_PASSWORD_MAX_LENGTH)
    currentPassword: string

    @ApiProperty({ type: 'string', format: 'password', minLength: EPIC_USER_PASSWORD_MIN_LENGTH, maxLength: EPIC_USER_PASSWORD_MAX_LENGTH })
    @TransformKeepPlainValue()
    @IsString()
    @Length(EPIC_USER_PASSWORD_MIN_LENGTH, EPIC_USER_PASSWORD_MAX_LENGTH)
    newPassword: string

}
