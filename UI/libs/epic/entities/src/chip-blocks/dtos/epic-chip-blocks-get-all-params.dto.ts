import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsOptional, IsString, Max } from 'class-validator'
import { EpicApiPager, EpicChipBlocksListQuery } from 'epic-api-types'


/**
 * `GET /chip-blocks` query string: the shared filter (`EpicChipBlocksListQuery`) plus paging (`EpicApiPager`).
 */
export class EpicChipBlocksGetAllParamsDto implements EpicChipBlocksListQuery, Partial<EpicApiPager> {

    @IsArray()
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'number' }, required: false })
    ids?: number[]

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', required: false })
    chipId?: number

    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'string' }, required: false })
    chipBlockTypes?: string[]

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string', required: false })
    serialNumber?: string

    @IsNumber()
    @ApiProperty({ type: 'number', default: 40 })
    @IsOptional()
    @Max(10 * 1000)
    limit?: number = 40

    @IsNumber()
    @ApiProperty({ type: 'number', default: 0 })
    @IsOptional()
    offset?: number = 0

}
