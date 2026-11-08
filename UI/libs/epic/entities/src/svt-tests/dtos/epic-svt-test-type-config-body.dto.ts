import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'
import { EpicSvtTestTypeConfigBody } from 'svt-ts-types'


export class EpicSvtTestTypeConfigBodyDto implements EpicSvtTestTypeConfigBody {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Config file content as plain text: JSON or JSON5' })
    configBody: string

}

