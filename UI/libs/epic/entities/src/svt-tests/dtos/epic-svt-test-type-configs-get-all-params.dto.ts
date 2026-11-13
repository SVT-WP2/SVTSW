import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsOptional } from 'class-validator'
import { EpicSvtTestTypeConfigsListQuery } from 'epic-api-types'


export class EpicSvtTestTypeConfigsGetAllParamsDto implements EpicSvtTestTypeConfigsListQuery {

    @IsArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    @IsOptional()
    ids?: number[]

    @IsNumber()
    @ApiProperty({ type: 'number', required: false })
    @IsOptional()
    testTypeId?: number

}
