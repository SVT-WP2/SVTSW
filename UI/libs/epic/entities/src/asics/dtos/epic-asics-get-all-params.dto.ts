import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsOptional, IsString, Max } from 'class-validator'
import { EpicApiPager, EpicAsicsListQuery } from 'epic-api-types'


/**
 * `GET /asics` query string: the shared filter (`EpicAsicsListQuery`) plus paging (`EpicApiPager`). The
 * `implements` clauses turn a renamed or added filter member into a compile error here instead of a query
 * param the global `ValidationPipe` (`whitelist: true`) silently drops.
 */
export class EpicAsicsGetAllParamsDto implements EpicAsicsListQuery, Partial<EpicApiPager> {

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', required: false })
    waferId?: number

    @IsNumber()
    @IsOptional()
    @ApiProperty({ type: 'number', required: false })
    chipId?: number

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string', required: false })
    asicQuality?: string

    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'string' }, required: false })
    asicFamilyTypes?: string[]

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
