import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString, ValidateIf } from 'class-validator'

import { EpicSvtTestTypeConfigCreateEntity } from '../models'


export class EpicSvtTestTypeConfigCreateDto implements EpicSvtTestTypeConfigCreateEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeId: number

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ValidateIf((obj) => obj.note !== null && obj.note !== '')
    @ApiProperty({ type: 'string', nullable: true })
    note: string | null

    @IsString()
    @ApiProperty({ type: 'string', description: 'stringified JSON' })
    configBody: string

}

