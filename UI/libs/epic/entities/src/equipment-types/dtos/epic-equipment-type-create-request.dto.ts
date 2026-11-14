import { ApiProperty } from '@nestjs/swagger'
import { IsString } from 'class-validator'
import { EpicEquipmentTypeCreateRequest } from 'svt-ts-types'


export class EpicEquipmentTypeCreateRequestDto implements EpicEquipmentTypeCreateRequest {

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

}
