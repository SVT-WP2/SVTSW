import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicChipEntity } from '../models'


export class EpicChipDto implements EpicChipEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsString()
    @ApiProperty({ type: 'string' })
    generalLocation: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value asicFamilyType' })
    familyType: string

}
