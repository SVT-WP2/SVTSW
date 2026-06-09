import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsString } from 'class-validator'

import { EpicSvtTestTypeUpdateEntity } from '../models'


export class EpicSvtTestTypeUpdateDto implements EpicSvtTestTypeUpdateEntity {

    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ type: 'string', isArray: true })
    dutTypes: string[]

}

