import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsOptional, IsString } from 'class-validator'
import { EpicDateString, EpicWaferCreateRequest } from 'svt-ts-types'


export class EpicWaferCreateRequestDto implements EpicWaferCreateRequest {

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

