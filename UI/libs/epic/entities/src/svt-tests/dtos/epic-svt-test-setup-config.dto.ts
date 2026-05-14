import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'

import { EpicSvtTestSetupConfigEntity } from '../models'


export class EpicSvtTestSetupConfigDto implements EpicSvtTestSetupConfigEntity {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    setupId: number

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string', nullable: true })
    note: string

    @IsDateString()
    @ApiProperty({ type: 'string', format: 'date-time ISO string' })
    createdAt: string

}
