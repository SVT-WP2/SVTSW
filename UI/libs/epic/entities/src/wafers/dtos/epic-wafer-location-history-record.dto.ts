import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'
import { EpicDateString, EpicWaferLocationHistoryRecord } from 'epic-api-types'


export class EpicWaferLocationHistoryRecordDto implements EpicWaferLocationHistoryRecord {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    waferId: number

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
