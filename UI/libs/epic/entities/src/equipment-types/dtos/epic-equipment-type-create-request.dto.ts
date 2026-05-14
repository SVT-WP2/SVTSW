import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'


export class EpicEquipmentTypeCreateRequestDto {

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

}
