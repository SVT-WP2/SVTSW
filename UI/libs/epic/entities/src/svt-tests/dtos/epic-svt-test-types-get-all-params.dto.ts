import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional } from 'class-validator'

import { EpicSvtTestTypesGetAllParams } from '../models'


export class EpicSvtTestTypesGetAllParamsDto implements EpicSvtTestTypesGetAllParams {

    @IsArray()
    @ApiProperty({ type: 'number', isArray: true })
    @IsOptional()
    ids?: number[]

    @IsArray()
    @ApiProperty({ type: 'string', isArray: true })
    @IsOptional()
    dutTypes?: string[]

}
