import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsInt, IsNumber, IsOptional, IsString, Max } from 'class-validator'
import { EpicApiPager, EpicChipsListQuery } from 'svt-ts-types'

import { TransformQueryNumberArray, TransformQueryStringArray } from '../../common'


/**
 * `GET /chips` query string: the shared filter (`EpicChipsListQuery`) plus paging (`EpicApiPager`). Its pair in
 * `contract/epic-api-contract-checks.models.ts` (not `implements` alone — every filter member is optional) turns a
 * renamed or added filter member into a compile error instead of a param the `ValidationPipe` silently drops.
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
    @IsInt({ each: true })
    @IsOptional()
    @TransformQueryNumberArray()
    @ApiProperty({ isArray: true, items: { type: 'number' }, required: false })
    ids?: number[]

    @IsString({ each: true })
    @IsOptional()
    @TransformQueryStringArray()
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
