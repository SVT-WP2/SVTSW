import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsOptional, IsString, Max } from 'class-validator'

import { EpicGetAllChipsQueryFilter } from '../models'


export class EpicChipsGetAllParamsDto implements EpicGetAllChipsQueryFilter {

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    generalLocation: string

    @IsArray()
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'number'} })
    ids: number[]

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
