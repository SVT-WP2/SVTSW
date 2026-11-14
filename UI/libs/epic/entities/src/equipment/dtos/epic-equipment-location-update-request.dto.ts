import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsOptional, IsString } from 'class-validator'
import { EpicDateString, EpicEquipmentLocationUpdateRequest } from 'svt-ts-types'


export class EpicEquipmentLocationUpdateRequestDto implements EpicEquipmentLocationUpdateRequest {

    @ApiProperty({ type: 'string' })
    @IsString()
    generalLocation: string

    @ApiProperty({ type: 'string' })
    @IsString()
    note: string

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsOptional()
    @IsDateString({ strict: true })
    date: EpicDateString | null

}
