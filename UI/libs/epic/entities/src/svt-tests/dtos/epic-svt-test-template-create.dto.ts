import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsString } from 'class-validator'

import { EpicSvtTestTemplateCreateEntity } from '../models'


export class EpicSvtTestTemplateCreateDto implements EpicSvtTestTemplateCreateEntity {

    @IsBoolean()
    @ApiProperty({ type: 'boolean' })
    isEnabled: boolean

    @IsString()
    @ApiProperty({ type: 'string' })
    dutType: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeConfigId: number

}

