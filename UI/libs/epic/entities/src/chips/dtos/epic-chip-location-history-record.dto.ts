import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'

import { EpicDateString } from '../../common'


export class EpicChipLocationHistoryRecordDto {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    chipId: number
    
    @ApiProperty({ type: 'string' })
    @IsString()
    generalLocation: string | null

    @ApiProperty({ type: 'string' })
    note: string

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsDateString({ strict: true })
    date: EpicDateString | null

    @ApiProperty({ required: false, type: 'string', nullable: true })
    username: EpicDateString | null

}

