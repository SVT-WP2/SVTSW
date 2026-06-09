import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'


export class EpicEquipmentTypeDto {

    @ApiProperty({ type: 'number' })
    @IsNumber()
    id: number

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

}

