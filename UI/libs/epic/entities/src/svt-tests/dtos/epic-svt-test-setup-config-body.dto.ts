import { ApiProperty } from '@nestjs/swagger'
import { IsNumber, IsString } from 'class-validator'
import { EpicSvtTestSetupConfigBody } from 'svt-ts-types'


export class EpicSvtTestSetupConfigBodyDto implements EpicSvtTestSetupConfigBody {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string', description: 'Config file content as plain text: JSON or JSON5' })
    configBody: string

}
