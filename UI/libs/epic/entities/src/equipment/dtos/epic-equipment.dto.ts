import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'


export class EpicEquipmentDto {

    @ApiProperty({ type: 'number' })
    @IsNumber()
    id: number

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

    @ApiProperty({ type: 'number' })
    @IsNumber()
    equipmentTypeId: number

    @ApiProperty({ type: 'string' })
    @IsString()
    generalLocation: string

    @ApiProperty({ type: 'string' })
    @IsString()
    specification: string

}

