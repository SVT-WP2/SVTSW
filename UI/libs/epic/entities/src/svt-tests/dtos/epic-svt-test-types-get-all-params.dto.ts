import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional } from 'class-validator'
import { EpicSvtTestTypesListQuery } from 'epic-api-types'


export class EpicSvtTestTypesGetAllParamsDto implements EpicSvtTestTypesListQuery {

    @IsArray()
    @ApiProperty({ type: 'number', isArray: true })
    @IsOptional()
    ids?: number[]

    @IsArray()
    @ApiProperty({ type: 'string', isArray: true })
    @IsOptional()
    dutTypes?: string[]

}
