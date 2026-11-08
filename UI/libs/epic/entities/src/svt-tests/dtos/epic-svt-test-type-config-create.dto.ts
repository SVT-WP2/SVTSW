import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString, ValidateIf } from 'class-validator'
import { EpicSvtTestTypeConfigCreateRequest } from 'svt-ts-types'


export class EpicSvtTestTypeConfigCreateDto implements EpicSvtTestTypeConfigCreateRequest {

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
    @ApiProperty({ type: 'string', description: 'Config file content as plain text: JSON or JSON5' })
    configBody: string

}

