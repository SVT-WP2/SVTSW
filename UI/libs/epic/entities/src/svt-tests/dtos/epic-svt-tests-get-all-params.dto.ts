import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsInt, IsISO8601, IsNumber, IsOptional, IsString, Max } from 'class-validator'
import { EpicSvtTestsListQuery } from 'epic-api-types'

import { TransformQueryNumberArray, TransformQueryStringArray } from '../../common'


export class EpicSvtTestsGetAllParamsDto implements EpicSvtTestsListQuery {

    @IsArray()
    @IsInt({ each: true })
    @TransformQueryNumberArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    @IsOptional()
    ids?: number[]

    @IsArray()
    @IsString({ each: true })
    @TransformQueryStringArray()
    @ApiProperty({ type: 'string', isArray: true, required: false })
    @IsOptional()
    dutEntityNames?: string[]

    @IsNumber()
    @ApiProperty({ type: 'number', required: false, description: 'Meant to be combined with dutEntityNames' })
    @IsOptional()
    dutId?: number

    @IsString({ each: true })
    @TransformQueryStringArray()
    @ApiProperty({ type: 'string', isArray: true, required: false, description: 'Enum values of EpicSvtTestStatus' })
    @IsOptional()
    statuses?: string[]

    @IsArray()
    @IsInt({ each: true })
    @TransformQueryNumberArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    @IsOptional()
    testTypeConfigIds?: number[]

    @IsArray()
    @IsInt({ each: true })
    @TransformQueryNumberArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    @IsOptional()
    testSetupConfigIds?: number[]

    @IsISO8601()
    @ApiProperty({ type: 'string', required: false, description: 'Lower bound of the createdAt range, inclusive' })
    @IsOptional()
    createdAtFrom?: string

    @IsISO8601()
    @ApiProperty({ type: 'string', required: false, description: 'Upper bound of the createdAt range, exclusive' })
    @IsOptional()
    createdAtTo?: string

    @IsISO8601()
    @ApiProperty({ type: 'string', required: false, description: 'Lower bound of the startedAt range, inclusive' })
    @IsOptional()
    startedAtFrom?: string

    @IsISO8601()
    @ApiProperty({ type: 'string', required: false, description: 'Upper bound of the startedAt range, exclusive' })
    @IsOptional()
    startedAtTo?: string

    @IsISO8601()
    @ApiProperty({ type: 'string', required: false, description: 'Lower bound of the finishedAt range, inclusive' })
    @IsOptional()
    finishedAtFrom?: string

    @IsISO8601()
    @ApiProperty({ type: 'string', required: false, description: 'Upper bound of the finishedAt range, exclusive' })
    @IsOptional()
    finishedAtTo?: string

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
