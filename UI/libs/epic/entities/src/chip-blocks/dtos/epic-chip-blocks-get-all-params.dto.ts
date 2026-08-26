import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsOptional, IsString, Max } from 'class-validator'

import { EpicGetAllChipBlocksQueryFilter } from '../models'


export class EpicChipBlocksGetAllParamsDto implements EpicGetAllChipBlocksQueryFilter {

    @IsArray()
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'number' } })
    ids?: number[]

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number' })
    chipId?: number

    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'string' } })
    chipBlockTypes?: string[]

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    serialNumber?: string

    @IsNumber()
    @ApiProperty({ type: 'number', default: 40 })
    @IsOptional()
    @Max(10 * 1000)
    limit?: number = 40

    @IsNumber()
    @ApiProperty({ type: 'number', default: 20 })
    @IsOptional()
    offset?: number = 0

}
