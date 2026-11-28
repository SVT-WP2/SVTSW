import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'
import { EPIC_USER_PASSWORD_MAX_LENGTH, EPIC_USER_PASSWORD_MIN_LENGTH, EpicUserPasswordSetRequest } from 'svt-ts-types'

import { TransformKeepPlainValue } from '../../common'


/** The body of `POST /api/users/:id/password`. */
export class EpicUserPasswordSetRequestDto implements EpicUserPasswordSetRequest {

    @ApiProperty({ type: 'string', format: 'password', minLength: EPIC_USER_PASSWORD_MIN_LENGTH, maxLength: EPIC_USER_PASSWORD_MAX_LENGTH })
    @TransformKeepPlainValue()
    @IsString()
    @Length(EPIC_USER_PASSWORD_MIN_LENGTH, EPIC_USER_PASSWORD_MAX_LENGTH)
    password: string

}
