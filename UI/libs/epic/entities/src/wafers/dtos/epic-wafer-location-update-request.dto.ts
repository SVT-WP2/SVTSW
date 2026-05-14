import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString } from 'class-validator'

import { EpicDateString } from '../../common'


export class EpicWaferLocationUpdateRequestDto {

    @ApiProperty({ type: 'string' })
    @IsString()
    generalLocation: string | null

    @ApiProperty({ type: 'string' })
    @IsString()
    note: string

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsOptional()
    @IsDateString({ strict: true })
    date: EpicDateString | null

}

