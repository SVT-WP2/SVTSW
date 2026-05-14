import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'


export class EpicEquipmentCreateRequestDto {


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
