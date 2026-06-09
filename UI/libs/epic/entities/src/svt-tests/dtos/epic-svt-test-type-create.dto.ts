import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'

import { EpicSvtTestTypeCreateEntity } from '../models'


export class EpicSvtTestTypeDefaultConfigCreateDto {

    @IsString()
    @ApiProperty({ type: 'string' })
    name!: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'JSON string' })
    configBody!: string

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    note: string

}

export class EpicSvtTestTypeCreateDto implements EpicSvtTestTypeCreateEntity {

    @IsString()
    @ApiProperty({ type: 'string' })
    name: string

    @IsArray()
    @IsString({ each: true })
    @ApiProperty({ type: 'string', isArray: true })
    dutTypes: string[]

    @ApiProperty({ type: EpicSvtTestTypeDefaultConfigCreateDto })
    @ValidateNested()
    @Type(() => EpicSvtTestTypeDefaultConfigCreateDto)
    testTypeConfig!: EpicSvtTestTypeDefaultConfigCreateDto

}

