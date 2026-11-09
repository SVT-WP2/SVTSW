import { ApiProperty } from '@nestjs/swagger'
import { Transform } from 'class-transformer'
import { IsArray, IsOptional, IsString } from 'class-validator'
import { EpicEnumsCollectionQuery } from 'epic-api-types'


export class EpicEnumsCollectionQueryFilterDto implements EpicEnumsCollectionQuery {

    @ApiProperty({ type: [String], required: false, description: 'Comma-separated enum names (values of EpicEnumName)' })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    // `?enumNames=a,b`, `?enumNames=a&enumNames=b` and `?enumNames[]=a` all arrive here; the implicit conversion of the
    // ValidationPipe may already have wrapped a single value in an array, so never assume a string.
    @Transform(({ value }: { value: unknown }) => (Array.isArray(value) ? value : [value]).flatMap((item) => String(item).split(',')))
    enumNames?: string[]

}
