import { ApiProperty } from '@nestjs/swagger'
import { IsBoolean, IsNumber, IsString } from 'class-validator'
import { EpicSvtTestTemplateCreateRequest } from 'svt-ts-types'


export class EpicSvtTestTemplateCreateDto implements EpicSvtTestTemplateCreateRequest {

    @IsBoolean()
    @ApiProperty({ type: 'boolean' })
    isEnabled: boolean

    @IsString()
    @ApiProperty({ type: 'string' })
    dutType: string

    @IsNumber()
    @ApiProperty({ type: 'number' })
    testTypeConfigId: number

}

