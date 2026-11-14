import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'
import { EpicEquipmentType } from 'svt-ts-types'


export class EpicEquipmentTypeDto implements EpicEquipmentType {

    @ApiProperty({ type: 'number' })
    @IsNumber()
    id: number

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

}
