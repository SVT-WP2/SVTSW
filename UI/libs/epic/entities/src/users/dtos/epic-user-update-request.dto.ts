import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator'
import { EpicUserRole, EpicUserUpdateRequest } from 'svt-ts-types'

import { TransformKeepPlainValue } from '../../common'

import { EpicUserCreateRequestDto } from './epic-user-create-request.dto'


/** The body of `PATCH /api/users/:id`. An absent key keeps the value; the DB agent checks the name rule. */
export class EpicUserUpdateRequestDto implements EpicUserUpdateRequest {

    @ApiProperty({ type: 'string', required: false, description: '1 to 100 characters after trimming' })
    @TransformKeepPlainValue()
    @IsOptional()
    @IsString()
    @MaxLength(EpicUserCreateRequestDto.NAME_MAX_LENGTH)
    name?: string

    @ApiProperty({ enum: EpicUserRole, required: false })
    @TransformKeepPlainValue()
    @IsOptional()
    @IsEnum(EpicUserRole)
    role?: EpicUserRole

    @ApiProperty({ type: 'boolean', required: false, description: 'false switches the user off' })
    @TransformKeepPlainValue()
    @IsOptional()
    @IsBoolean()
    isActive?: boolean

}
