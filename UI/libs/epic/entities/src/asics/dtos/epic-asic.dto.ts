import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicAsic } from 'svt-ts-types'


export class EpicAsicDto implements EpicAsic {

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
    @ApiProperty({ type: 'number', required: false, nullable: true })
    chipId?: number | null

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
