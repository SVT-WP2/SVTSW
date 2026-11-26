import { ApiProperty } from '@nestjs/swagger'
import { IsString, Length } from 'class-validator'
import { EpicAuthLoginRequest } from 'svt-ts-types'


/** The body of `POST /api/auth/login`. The lengths only bound the work; the DB agent knows the login rule. */
export class EpicAuthLoginRequestDto implements EpicAuthLoginRequest {

    static readonly LOGIN_MAX_LENGTH = 100
    static readonly PASSWORD_MAX_LENGTH = 128

    @ApiProperty({ type: 'string', description: 'Trimmed and compared in lower case' })
    @IsString()
    @Length(1, EpicAuthLoginRequestDto.LOGIN_MAX_LENGTH)
    login: string

    @ApiProperty({ type: 'string', format: 'password' })
    @IsString()
    @Length(1, EpicAuthLoginRequestDto.PASSWORD_MAX_LENGTH)
    password: string

}
