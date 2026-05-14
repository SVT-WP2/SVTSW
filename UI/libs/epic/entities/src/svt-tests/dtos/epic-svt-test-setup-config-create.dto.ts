import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString, ValidateIf } from 'class-validator'

import { EpicSvtTestSetupConfigCreateEntity } from '../models'


export class EpicSvtTestSetupConfigCreateDto implements EpicSvtTestSetupConfigCreateEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    setupId: number

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ValidateIf((obj) => obj.note !== null && obj.note !== '')
    @ApiProperty({ type: 'string', nullable: true })
    note: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'stringified JSON' })
    configBody: string

}
