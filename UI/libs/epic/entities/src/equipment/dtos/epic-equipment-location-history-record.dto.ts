import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'
import { EpicDateString, EpicEquipmentLocationHistoryRecord } from 'svt-ts-types'


export class EpicEquipmentLocationHistoryRecordDto implements EpicEquipmentLocationHistoryRecord {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    equipmentId: number

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
