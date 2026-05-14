import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsOptional } from 'class-validator'

import { EpicSvtTestTemplatesGetAllParams } from '../models'


export class EpicSvtTestTemplatesGetAllParamsDto implements EpicSvtTestTemplatesGetAllParams {

    @IsArray()
    @ApiProperty({ type: 'number', isArray: true, required: false })
    @IsOptional()
    ids?: number[]

    @IsArray()
    @ApiProperty({ type: 'string', isArray: true, required: false })
    @IsOptional()
    dutTypes?: string[]

}

