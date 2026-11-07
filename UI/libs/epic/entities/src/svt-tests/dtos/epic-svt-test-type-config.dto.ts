import { ApiProperty } from '@nestjs/swagger'
import { IsDateString, IsNumber, IsString } from 'class-validator'
import { EpicSvtTestTypeConfig } from 'epic-api-types'


export class EpicSvtTestTypeConfigDto implements EpicSvtTestTypeConfig {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeId: number

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsString()
    @ApiProperty({ type: 'string', nullable: true })
    note: string | null

    @IsDateString()
    @ApiProperty({ type: 'string', format: 'date-time ISO string' })
    createdAt: string

}

