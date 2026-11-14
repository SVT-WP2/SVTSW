import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsInt, IsNumber, IsOptional } from 'class-validator'
import { EpicSvtTestTypeConfigsListQuery } from 'svt-ts-types'

import { TransformQueryNumberArray } from '../../common'


export class EpicSvtTestTypeConfigsGetAllParamsDto implements EpicSvtTestTypeConfigsListQuery {

    @IsArray()
    @IsInt({ each: true })
    @TransformQueryNumberArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    @IsOptional()
    ids?: number[]

    @IsNumber()
    @ApiProperty({ type: 'number', required: false })
    @IsOptional()
    testTypeId?: number

}
