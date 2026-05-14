import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'

import { EpicDateString } from '../../common'


export class EpicEquipmentLocationHistoryRecordDto {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    equipmentId: number
    
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

