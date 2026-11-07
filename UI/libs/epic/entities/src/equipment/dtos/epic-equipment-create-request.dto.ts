import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'
import { EpicEquipmentCreateRequest } from 'epic-api-types'


export class EpicEquipmentCreateRequestDto implements EpicEquipmentCreateRequest {

    @ApiProperty({ type: 'string' })
    @IsString()
    name: string

    @ApiProperty({ type: 'number' })
    @IsNumber()
    equipmentTypeId: number

    @ApiProperty({ type: 'string', description: 'Enum value wpGeneralLocation' })
    @IsString()
    generalLocation: string

    @ApiProperty({ type: 'string', description: 'Stringified JSON' })
    @IsString()
    specification: string

}
