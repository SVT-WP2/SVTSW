import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional, IsString } from 'class-validator'
import { EpicEnumsCollectionQuery } from 'svt-ts-types'

import { TransformQueryStringArray } from '../../common'


export class EpicEnumsCollectionQueryFilterDto implements EpicEnumsCollectionQuery {

    @ApiProperty({ type: [String], required: false, description: 'Comma-separated enum names (values of EpicEnumName)' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @TransformQueryStringArray()
    enumNames?: string[]

}
