import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsArray, IsOptional, IsString } from 'class-validator'
import { EpicEnumsCollectionQuery } from 'epic-api-types'


export class EpicEnumsCollectionQueryFilterDto implements EpicEnumsCollectionQuery {

    @ApiProperty({ type: [String], required: false, description: 'Comma-separated enum names (values of EpicEnumName)' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    @Transform(({ value }) => value.split(','))
    enumNames?: string[]

}
