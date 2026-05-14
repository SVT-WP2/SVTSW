import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsString } from 'class-validator'

import { EpicSvtTestTypeEntity } from '../models'


export class EpicSvtTestTypeDto implements EpicSvtTestTypeEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ type: 'string', isArray: true })
    dutTypes: string[]

}

