import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'

import { EpicSvtTestTypeConfigBodyEntity } from '../models'


export class EpicSvtTestTypeConfigBodyDto implements EpicSvtTestTypeConfigBodyEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'stringified JSON' })
    configBody: string

}

