import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsOptional, IsString, Max } from 'class-validator'
import { EpicApiPager, EpicChipsListQuery } from 'epic-api-types'


/**
 * `GET /chips` query string: the shared filter (`EpicChipsListQuery`) plus paging (`EpicApiPager`). The `implements`
 * clauses turn a renamed or added filter member into a compile error here instead of a query param the global
 * `ValidationPipe` (`whitelist: true`) silently drops.
 */
export class EpicChipsGetAllParamsDto implements EpicChipsListQuery, Partial<EpicApiPager> {

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string', required: false })
    serialNumber?: string

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string', required: false })
    generalLocation?: string

    @IsArray()
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'number' }, required: false })
    ids?: number[]

    @IsString({ each: true })
    @IsOptional()
    @ApiProperty({ isArray: true, items: { type: 'string' }, required: false })
    familyTypes?: string[]

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
