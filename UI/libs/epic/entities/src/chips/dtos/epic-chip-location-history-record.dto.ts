import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'
import { EpicDateString, EpicChipLocationHistoryRecord } from 'svt-ts-types'


export class EpicChipLocationHistoryRecordDto implements EpicChipLocationHistoryRecord {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    chipId: number

    @ApiProperty({ type: 'string' })
    @IsString()
    generalLocation: string

    @ApiProperty({ type: 'string' })
    note: string

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsDateString({ strict: true })
    date: EpicDateString | null

    @ApiProperty({ required: false, type: 'string', nullable: true })
    username: string | null

}
