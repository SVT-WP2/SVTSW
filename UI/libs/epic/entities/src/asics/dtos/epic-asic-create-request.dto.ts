import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicAsicCreateEntity } from '../models'


export class EpicAsicCreateRequestDto implements EpicAsicCreateEntity {

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    waferId: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value asicFamilyType' })
    familyType: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Stringified JSON' })
    waferMapPosition: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value asicQuality' })
    quality: string

}

