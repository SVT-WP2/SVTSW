import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator'

import { EpicDateString } from '../../common'
import { EpicWaferCreateEntity } from '../models'


export class EpicWaferCreateRequestDto implements EpicWaferCreateEntity {

    @IsString()
    @ApiProperty({ type: 'string' })
    serialNumber: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    batchNumber: number

    @IsOptional()
    @IsDateString({ strict: true })
    @ApiProperty({ type: 'string', nullable: true })
    thinningDate: EpicDateString

    @IsOptional()
    @IsDateString({ strict: true })
    @ApiProperty({ type: 'string', nullable: true })
    dicingDate: EpicDateString

    @IsOptional()
    @IsDateString({ strict: true })
    @ApiProperty({ type: 'string', nullable: true })
    productionDate: EpicDateString

    @IsNumber()
    @ApiProperty({ type: 'number' })
    waferTypeId: number

    @ApiProperty({ required: false, type: 'string', nullable: true })
    @IsOptional()
    @IsString()
    generalLocation: string | null

}

