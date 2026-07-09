import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsOptional, IsString } from 'class-validator'

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
    blockTypes?: string[]

}
