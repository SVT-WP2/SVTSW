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

    @ApiProperty({
        required: false,
        type: 'string',
        nullable: true,
        description: 'Free text that a client sent with the move; the UI sends none. Rows from before the users may hold a name here.',
    })
    username: string | null

    @ApiProperty({ type: 'number', nullable: true, description: 'The id of the user who moved it; null for a row without one' })
    userId: number | null

    @ApiProperty({
        type: 'string',
        nullable: true,
        description: 'The name of that user, also of a user who was switched off later; null for a row without one',
    })
    userName: string | null

}
