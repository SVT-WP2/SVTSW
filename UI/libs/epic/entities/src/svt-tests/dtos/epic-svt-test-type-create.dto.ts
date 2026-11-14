import { ApiProperty } from '@nestjs/swagger'
import { Type } from 'class-transformer'
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator'
import { EpicSvtTestTypeCreateRequest, EpicSvtTestTypeDefaultConfigCreateRequest } from 'svt-ts-types'


export class EpicSvtTestTypeDefaultConfigCreateDto implements EpicSvtTestTypeDefaultConfigCreateRequest {

    @IsString()
    @ApiProperty({ type: 'string' })
    name!: string

    @IsString()
    @ApiProperty({ type: 'string', description: 'Config file content as a plain text (JSON, JSON5 or any other text file format)' })
    configBody!: string

    @IsString()
    @IsOptional()
    @ApiProperty({ type: 'string' })
    note: string

}

export class EpicSvtTestTypeCreateDto implements EpicSvtTestTypeCreateRequest {

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

