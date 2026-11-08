import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator'
import { EpicSvtTestTypesListQuery } from 'svt-ts-types'

import { TransformQueryNumberArray, TransformQueryStringArray } from '../../common'


export class EpicSvtTestTypesGetAllParamsDto implements EpicSvtTestTypesListQuery {

    @IsArray()
    @IsInt({ each: true })
    @TransformQueryNumberArray()
    @ApiProperty({ type: 'number', isArray: true })
    @IsOptional()
    ids?: number[]

    @IsArray()
    @IsString({ each: true })
    @TransformQueryStringArray()
    @ApiProperty({ type: 'string', isArray: true })
    @IsOptional()
    dutTypes?: string[]

}
