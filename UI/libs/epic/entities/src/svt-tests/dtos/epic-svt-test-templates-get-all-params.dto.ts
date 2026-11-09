import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsInt, IsOptional, IsString } from 'class-validator'
import { EpicSvtTestTemplatesListQuery } from 'epic-api-types'

import { TransformQueryNumberArray, TransformQueryStringArray } from '../../common'


export class EpicSvtTestTemplatesGetAllParamsDto implements EpicSvtTestTemplatesListQuery {

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
    dutTypes?: string[]

}
