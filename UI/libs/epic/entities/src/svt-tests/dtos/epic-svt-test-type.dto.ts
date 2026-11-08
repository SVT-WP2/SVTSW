import { ApiProperty } from '@nestjs/swagger'
import { IsArray, IsNumber, IsString } from 'class-validator'
import { EpicSvtTestType } from 'svt-ts-types'


export class EpicSvtTestTypeDto implements EpicSvtTestType {

    @IsNumber()
    @ApiProperty({ type: 'number' })
    id: number

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ type: 'string', isArray: true })
    dutTypes: string[]

}

