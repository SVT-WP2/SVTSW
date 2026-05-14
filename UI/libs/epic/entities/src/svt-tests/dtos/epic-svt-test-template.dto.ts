import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsString } from 'class-validator'

import { EpicSvtTestTemplateEntity } from '../models'


export class EpicSvtTestTemplateDto implements EpicSvtTestTemplateEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string' })
    dutType: string

    @IsBoolean()
    @ApiProperty({ type: 'boolean' })
    isEnabled: boolean

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeId: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeConfigId: number

}

