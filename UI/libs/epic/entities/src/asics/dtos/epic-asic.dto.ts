import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString } from 'class-validator'

import { EpicAsicEntity } from '../models'


export class EpicAsicDto implements EpicAsicEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    waferId: number

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number' })
    chipId?: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value asicFamilyType' })
    familyType: string

    @IsString()
    @ApiProperty({ type: 'string' })
    waferMapPosition: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Enum value asicQuality' })
    quality: string

}
